"""
NEET AI Question Generation Engine - FastAPI backend
====================================================
Endpoints:
- /api/auth/*         : register, login, me
- /api/questions/*    : list, create, ai-generate, seed-demo, stats
- /api/blueprints/*   : CRUD
- /api/exams/*        : CRUD, join, submit, monitor, result
- /api/analytics/*    : dashboard summary
"""
import os
import io
import csv
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (
    UserRegister, UserLogin, UserPublic, TokenResponse,
    QuestionCreate, Question,
    BlueprintCreate, Blueprint,
    ExamCreate, Exam,
    SubmitExam, ExamResult,
    AIGenRequest, DemoSeedRequest,
    ProctorEventCreate, ProctorEvent,
)

# Proctor event weights (risk-score contribution)
EVENT_WEIGHT = {
    "tab_hidden": 3,
    "window_blur": 2,
    "paste_attempt": 5,
    "copy_attempt": 2,
    "context_menu": 1,
    "fullscreen_exit": 4,
    "rapid_switch": 4,
}
RISK_HIGH = 15
RISK_MEDIUM = 6
from auth import hash_password, verify_password, create_token, get_current_user, require_admin
from paper_engine import build_paper_for_candidate, encrypt_paper, decrypt_paper
from ai_service import generate_questions_ai
from seed_data import build_seed_questions, CHAPTERS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("neet")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="NEET AI Question Generation Engine")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.questions.create_index([("subject", 1), ("difficulty", 1), ("chapter", 1)])
    await db.questions.create_index("id", unique=True)
    await db.blueprints.create_index("id", unique=True)
    await db.exams.create_index("id", unique=True)
    await db.papers.create_index([("exam_id", 1), ("candidate_id", 1)], unique=True)
    await db.results.create_index([("exam_id", 1), ("candidate_id", 1)], unique=True)
    await db.proctor_events.create_index([("exam_id", 1), ("candidate_id", 1), ("created_at", -1)])

    if not await db.users.find_one({"email": "admin@neetai.com"}):
        await db.users.insert_one({
            "id": "admin-root-user",
            "email": "admin@neetai.com",
            "password_hash": hash_password("Admin@123"),
            "full_name": "System Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin: admin@neetai.com / Admin@123")

    if not await db.users.find_one({"email": "student@neetai.com"}):
        await db.users.insert_one({
            "id": "candidate-demo-user",
            "email": "student@neetai.com",
            "password_hash": hash_password("Student@123"),
            "full_name": "Demo Candidate",
            "role": "candidate",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded candidate: student@neetai.com / Student@123")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ============================================================
# AUTH
# ============================================================
@api.post("/auth/register", response_model=TokenResponse)
async def register(body: UserRegister):
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")
    import uuid
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": user_id,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": body.role,
        "created_at": now,
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, body.role)
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user_id, email=body.email, full_name=body.full_name, role=body.role, created_at=now),
    )


@api.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserPublic(
            id=user["id"], email=user["email"], full_name=user["full_name"],
            role=user["role"], created_at=user["created_at"],
        ),
    )


@api.get("/auth/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    return UserPublic(**user)


# ============================================================
# QUESTIONS
# ============================================================
@api.get("/questions")
async def list_questions(
    subject: Optional[str] = None,
    difficulty: Optional[str] = None,
    chapter: Optional[str] = None,
    q_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    skip: int = 0,
    _=Depends(get_current_user),
):
    q = {}
    if subject: q["subject"] = subject
    if difficulty: q["difficulty"] = difficulty
    if chapter: q["chapter"] = chapter
    if q_type: q["q_type"] = q_type
    if search: q["text"] = {"$regex": search, "$options": "i"}
    total = await db.questions.count_documents(q)
    items = await db.questions.find(q, {"_id": 0}).skip(skip).limit(limit).to_list(length=limit)
    return {"total": total, "items": items}


@api.post("/questions", response_model=Question)
async def create_question(body: QuestionCreate, admin=Depends(require_admin)):
    q = Question(**body.model_dump(), created_by=admin["id"], source="manual")
    await db.questions.insert_one(q.model_dump())
    return q


@api.post("/questions/generate-ai")
async def ai_generate(body: AIGenRequest, admin=Depends(require_admin)):
    t0 = time.perf_counter()
    try:
        generated = await generate_questions_ai(
            subject=body.subject, chapter=body.chapter, topic=body.topic,
            difficulty=body.difficulty, q_type=body.q_type, count=body.count,
        )
    except Exception as e:
        logger.exception("AI generation failed")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")
    for q in generated:
        q["created_by"] = admin["id"]
    if generated:
        await db.questions.insert_many([dict(q) for q in generated])
    for q in generated:
        q.pop("_id", None)
    return {"generated": len(generated), "elapsed_ms": (time.perf_counter()-t0)*1000, "items": generated}


@api.post("/questions/seed-demo")
async def seed_demo(body: DemoSeedRequest, admin=Depends(require_admin)):
    docs = build_seed_questions(per_subject=body.per_subject)
    if docs:
        await db.questions.insert_many(docs)
    return {"inserted": len(docs)}


@api.get("/questions/meta")
async def question_meta(_=Depends(get_current_user)):
    pipeline = [
        {"$group": {
            "_id": {"subject": "$subject", "difficulty": "$difficulty"},
            "count": {"$sum": 1},
        }},
    ]
    agg = await db.questions.aggregate(pipeline).to_list(length=200)
    total = await db.questions.count_documents({})
    by_subject = {"Physics": 0, "Chemistry": 0, "Biology": 0}
    by_difficulty = {"Easy": 0, "Medium": 0, "Hard": 0}
    matrix = []
    for row in agg:
        s = row["_id"]["subject"]; d = row["_id"]["difficulty"]; c = row["count"]
        by_subject[s] = by_subject.get(s, 0) + c
        by_difficulty[d] = by_difficulty.get(d, 0) + c
        matrix.append({"subject": s, "difficulty": d, "count": c})
    return {"total": total, "by_subject": by_subject, "by_difficulty": by_difficulty, "matrix": matrix, "chapters": CHAPTERS}


@api.post("/questions/upload-csv")
async def upload_csv(file: UploadFile = File(...), admin=Depends(require_admin)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    inserted = 0
    for row in reader:
        try:
            options = [
                {"key": "A", "text": row["opt_a"]},
                {"key": "B", "text": row["opt_b"]},
                {"key": "C", "text": row["opt_c"]},
                {"key": "D", "text": row["opt_d"]},
            ]
            q = Question(
                subject=row["subject"], chapter=row["chapter"], topic=row.get("topic", ""),
                difficulty=row["difficulty"], q_type=row.get("q_type", "Theoretical"),
                text=row["text"], options=options, correct_key=row["correct_key"],
                explanation=row.get("explanation", ""),
                tags=[t.strip() for t in row.get("tags","").split(",") if t.strip()],
                is_previous_year=(row.get("is_previous_year","").lower() in ("1","true","yes")),
                previous_year=int(row["previous_year"]) if row.get("previous_year","").isdigit() else None,
            )
            doc = q.model_dump()
            doc["created_by"] = admin["id"]
            doc["source"] = "csv"
            await db.questions.insert_one(doc)
            inserted += 1
        except Exception as e:
            logger.warning(f"CSV row skipped: {e}")
    return {"inserted": inserted}


# ============================================================
# BLUEPRINTS
# ============================================================
@api.post("/blueprints", response_model=Blueprint)
async def create_blueprint(body: BlueprintCreate, admin=Depends(require_admin)):
    bp = Blueprint(**body.model_dump(), created_by=admin["id"])
    await db.blueprints.insert_one(bp.model_dump())
    return bp


@api.get("/blueprints")
async def list_blueprints(_=Depends(get_current_user)):
    items = await db.blueprints.find({}, {"_id": 0}).to_list(length=200)
    return {"items": items}


@api.get("/blueprints/{bp_id}", response_model=Blueprint)
async def get_blueprint(bp_id: str, _=Depends(get_current_user)):
    bp = await db.blueprints.find_one({"id": bp_id}, {"_id": 0})
    if not bp: raise HTTPException(404, "Blueprint not found")
    return Blueprint(**bp)


@api.delete("/blueprints/{bp_id}")
async def delete_blueprint(bp_id: str, admin=Depends(require_admin)):
    res = await db.blueprints.delete_one({"id": bp_id})
    return {"deleted": res.deleted_count}


# ============================================================
# EXAMS
# ============================================================
@api.post("/exams", response_model=Exam)
async def create_exam(body: ExamCreate, admin=Depends(require_admin)):
    if not await db.blueprints.find_one({"id": body.blueprint_id}):
        raise HTTPException(400, "Blueprint not found")
    ex = Exam(**body.model_dump(), created_by=admin["id"])
    await db.exams.insert_one(ex.model_dump())
    return ex


@api.get("/exams")
async def list_exams(_=Depends(get_current_user)):
    items = await db.exams.find({}, {"_id": 0}).sort("scheduled_start", 1).to_list(length=200)
    now = datetime.now(timezone.utc)
    for it in items:
        start = datetime.fromisoformat(it["scheduled_start"].replace("Z","+00:00"))
        end_ts = start.timestamp() + it["duration_minutes"]*60
        if now.timestamp() < start.timestamp():
            it["computed_status"] = "scheduled"
        elif now.timestamp() < end_ts:
            it["computed_status"] = "live"
        else:
            it["computed_status"] = "ended"
    return {"items": items}


@api.get("/exams/{exam_id}")
async def get_exam(exam_id: str, _=Depends(get_current_user)):
    ex = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    if not ex: raise HTTPException(404, "Exam not found")
    bp = await db.blueprints.find_one({"id": ex["blueprint_id"]}, {"_id": 0})
    return {"exam": ex, "blueprint": bp}


@api.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, admin=Depends(require_admin)):
    res = await db.exams.delete_one({"id": exam_id})
    await db.papers.delete_many({"exam_id": exam_id})
    await db.results.delete_many({"exam_id": exam_id})
    return {"deleted": res.deleted_count}


@api.post("/exams/{exam_id}/join")
async def join_exam(exam_id: str, user=Depends(get_current_user)):
    ex = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    if not ex: raise HTTPException(404, "Exam not found")

    scheduled_start = datetime.fromisoformat(ex["scheduled_start"].replace("Z","+00:00"))
    now = datetime.now(timezone.utc)
    end_ts = scheduled_start.timestamp() + ex["duration_minutes"]*60
    if now.timestamp() < scheduled_start.timestamp():
        raise HTTPException(400, f"Exam has not started yet. Starts at {ex['scheduled_start']}")
    if now.timestamp() > end_ts:
        raise HTTPException(400, "Exam has ended")

    existing = await db.papers.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0})
    if existing:
        return {
            "paper_id": existing["id"],
            "encrypted_payload": existing["encrypted_payload"],
            "nonce": existing["nonce"],
            "generated_at": existing["generated_at"],
            "generated_in_ms": existing["generated_in_ms"],
            "duration_minutes": ex["duration_minutes"],
            "exam": ex,
            "already_joined": True,
        }

    bp = await db.blueprints.find_one({"id": ex["blueprint_id"]}, {"_id": 0})
    if not bp: raise HTTPException(500, "Blueprint missing")

    result = await build_paper_for_candidate(db, ex, bp, user["id"])
    payload = {"exam_id": exam_id, "candidate_id": user["id"], "questions": result["questions"]}
    enc = encrypt_paper(exam_id, user["id"], payload)

    import uuid
    paper_doc = {
        "id": str(uuid.uuid4()),
        "exam_id": exam_id,
        "candidate_id": user["id"],
        "question_ids": [q["id"] for q in result["questions"]],
        "encrypted_payload": enc["ciphertext"],
        "nonce": enc["nonce"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_in_ms": result["generated_in_ms"],
        "submitted": False,
    }
    await db.papers.insert_one(paper_doc)

    return {
        "paper_id": paper_doc["id"],
        "encrypted_payload": enc["ciphertext"],
        "nonce": enc["nonce"],
        "generated_at": paper_doc["generated_at"],
        "generated_in_ms": result["generated_in_ms"],
        "duration_minutes": ex["duration_minutes"],
        "exam": ex,
        "already_joined": False,
    }


@api.get("/exams/{exam_id}/paper")
async def get_paper(exam_id: str, user=Depends(get_current_user)):
    paper = await db.papers.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0})
    if not paper: raise HTTPException(404, "No paper generated. Join the exam first.")
    payload = decrypt_paper(exam_id, user["id"], paper["encrypted_payload"], paper["nonce"])
    for q in payload["questions"]:
        q.pop("correct_key", None)
        q.pop("explanation", None)
    return {"paper_id": paper["id"], "questions": payload["questions"], "submitted": paper.get("submitted", False), "paused": paper.get("paused", False), "pause_reason": paper.get("pause_reason")}


@api.post("/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, body: SubmitExam, user=Depends(get_current_user)):
    paper = await db.papers.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0})
    if not paper: raise HTTPException(404, "Paper not found")
    if paper.get("submitted"): raise HTTPException(400, "Already submitted")
    if paper.get("paused"): raise HTTPException(423, "Paper is paused by proctor. Contact your invigilator.")

    ex = await db.exams.find_one({"id": exam_id}, {"_id": 0})
    bp = await db.blueprints.find_one({"id": ex["blueprint_id"]}, {"_id": 0})
    m_correct = bp["marks_per_correct"]
    m_wrong = bp["marks_per_wrong"]

    payload = decrypt_paper(exam_id, user["id"], paper["encrypted_payload"], paper["nonce"])
    answer_map = {a.question_id: a.selected_key for a in body.answers}
    correct = wrong = unattempted = 0
    score = 0.0
    subject_stats = {}
    for q in payload["questions"]:
        subj = q["subject"]
        subject_stats.setdefault(subj, {"correct":0,"wrong":0,"unattempted":0,"score":0.0,"total":0})
        subject_stats[subj]["total"] += 1
        sel = answer_map.get(q["id"])
        if sel is None or sel == "":
            unattempted += 1
            subject_stats[subj]["unattempted"] += 1
        elif sel == q["correct_key"]:
            correct += 1
            score += m_correct
            subject_stats[subj]["correct"] += 1
            subject_stats[subj]["score"] += m_correct
        else:
            wrong += 1
            score += m_wrong
            subject_stats[subj]["wrong"] += 1
            subject_stats[subj]["score"] += m_wrong

    total_qs = len(payload["questions"])
    max_score = total_qs * m_correct

    import uuid
    result_doc = {
        "id": str(uuid.uuid4()),
        "exam_id": exam_id,
        "candidate_id": user["id"],
        "paper_id": paper["id"],
        "score": score,
        "max_score": max_score,
        "correct": correct,
        "wrong": wrong,
        "unattempted": unattempted,
        "subject_breakdown": subject_stats,
        "answers": [a.model_dump() for a in body.answers],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.results.update_one(
        {"exam_id": exam_id, "candidate_id": user["id"]},
        {"$set": result_doc},
        upsert=True,
    )
    await db.papers.update_one({"id": paper["id"]}, {"$set": {"submitted": True}})
    result_doc.pop("_id", None)
    return result_doc


@api.get("/exams/{exam_id}/result")
async def get_own_result(exam_id: str, user=Depends(get_current_user)):
    r = await db.results.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0})
    if not r: raise HTTPException(404, "No result yet")
    paper = await db.papers.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0})
    review = []
    if paper:
        payload = decrypt_paper(exam_id, user["id"], paper["encrypted_payload"], paper["nonce"])
        answers_map = {a["question_id"]: a.get("selected_key") for a in r.get("answers", [])}
        for q in payload["questions"]:
            review.append({
                "id": q["id"], "subject": q["subject"], "chapter": q["chapter"],
                "text": q["text"], "options": q["options"],
                "correct_key": q["correct_key"], "explanation": q.get("explanation",""),
                "selected_key": answers_map.get(q["id"]),
            })
    return {**r, "review": review}


@api.get("/exams/{exam_id}/monitor")
async def monitor(exam_id: str, admin=Depends(require_admin)):
    papers_count = await db.papers.count_documents({"exam_id": exam_id})
    submitted = await db.papers.count_documents({"exam_id": exam_id, "submitted": True})
    agg = await db.papers.aggregate([
        {"$match":{"exam_id":exam_id}},
        {"$group":{"_id":None,"avg":{"$avg":"$generated_in_ms"},"min":{"$min":"$generated_in_ms"},"max":{"$max":"$generated_in_ms"}}}
    ]).to_list(length=1)
    stats = agg[0] if agg else {"avg":0,"min":0,"max":0}
    latest = await db.papers.find({"exam_id": exam_id}, {"_id": 0, "encrypted_payload":0}).sort("generated_at",-1).limit(20).to_list(length=20)
    for p in latest:
        u = await db.users.find_one({"id": p["candidate_id"]}, {"_id": 0, "full_name":1, "email":1})
        p["candidate"] = u or {}
    return {
        "exam_id": exam_id,
        "papers_generated": papers_count,
        "submitted": submitted,
        "avg_generation_ms": stats.get("avg",0) or 0,
        "min_generation_ms": stats.get("min",0) or 0,
        "max_generation_ms": stats.get("max",0) or 0,
        "recent_papers": latest,
    }


@api.get("/exams/{exam_id}/leaderboard")
async def leaderboard(exam_id: str, _=Depends(get_current_user)):
    results = await db.results.find({"exam_id": exam_id}, {"_id":0}).sort("score",-1).limit(50).to_list(length=50)
    for r in results:
        u = await db.users.find_one({"id": r["candidate_id"]}, {"_id":0, "full_name":1, "email":1})
        r["candidate"] = u or {}
        r.pop("answers", None)
    return {"items": results}


# ============================================================
# PROCTORING - Live Cheat Signals
# ============================================================
@api.post("/exams/{exam_id}/proctor-events")
async def log_proctor_event(exam_id: str, body: ProctorEventCreate, user=Depends(get_current_user)):
    """Candidate logs a suspicious event during the exam. Auto-pauses the paper if risk >= HIGH."""
    paper = await db.papers.find_one({"exam_id": exam_id, "candidate_id": user["id"]}, {"_id": 0, "id": 1, "submitted": 1, "paused": 1})
    if not paper:
        raise HTTPException(400, "You have not joined this exam")
    if paper.get("submitted"):
        return {"ignored": True, "reason": "submitted"}

    ev = ProctorEvent(
        **body.model_dump(),
        exam_id=exam_id,
        candidate_id=user["id"],
        weight=EVENT_WEIGHT.get(body.event_type, 1),
    )
    await db.proctor_events.insert_one(ev.model_dump())

    # Auto-pause: recompute total risk for this candidate on this exam
    agg = await db.proctor_events.aggregate([
        {"$match": {"exam_id": exam_id, "candidate_id": user["id"]}},
        {"$group": {"_id": None, "score": {"$sum": "$weight"}}}
    ]).to_list(length=1)
    total = agg[0]["score"] if agg else 0
    auto_paused = False
    if total >= RISK_HIGH and not paper.get("paused"):
        await db.papers.update_one({"id": paper["id"]}, {"$set": {"paused": True, "pause_reason": "auto:high_risk", "paused_at": datetime.now(timezone.utc).isoformat()}})
        auto_paused = True

    return {"ok": True, "event_id": ev.id, "weight": ev.weight, "risk_score": total, "auto_paused": auto_paused}


@api.post("/exams/{exam_id}/candidates/{candidate_id}/pause")
async def admin_pause(exam_id: str, candidate_id: str, admin=Depends(require_admin)):
    res = await db.papers.update_one(
        {"exam_id": exam_id, "candidate_id": candidate_id},
        {"$set": {"paused": True, "pause_reason": "admin:manual", "paused_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Paper not found")
    return {"paused": True}


@api.post("/exams/{exam_id}/candidates/{candidate_id}/unpause")
async def admin_unpause(exam_id: str, candidate_id: str, admin=Depends(require_admin)):
    res = await db.papers.update_one(
        {"exam_id": exam_id, "candidate_id": candidate_id},
        {"$set": {"paused": False, "pause_reason": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Paper not found")
    return {"paused": False}


@api.get("/exams/{exam_id}/proctor-events")
async def list_proctor_events(exam_id: str, limit: int = 100, admin=Depends(require_admin)):
    """Admin fetches recent proctor events + per-candidate risk scores."""
    events = await db.proctor_events.find({"exam_id": exam_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    # Aggregate risk by candidate
    pipeline = [
        {"$match": {"exam_id": exam_id}},
        {"$group": {
            "_id": "$candidate_id",
            "score": {"$sum": "$weight"},
            "count": {"$sum": 1},
            "last_event_at": {"$max": "$created_at"},
        }},
        {"$sort": {"score": -1}},
    ]
    agg = await db.proctor_events.aggregate(pipeline).to_list(length=200)
    for row in agg:
        u = await db.users.find_one({"id": row["_id"]}, {"_id": 0, "full_name": 1, "email": 1})
        row["candidate_id"] = row.pop("_id")
        row["candidate"] = u or {}
        row["risk_level"] = "HIGH" if row["score"] >= RISK_HIGH else ("MEDIUM" if row["score"] >= RISK_MEDIUM else "LOW")
        paper_doc = await db.papers.find_one({"exam_id": exam_id, "candidate_id": row["candidate_id"]}, {"_id": 0, "paused": 1, "submitted": 1})
        row["paused"] = bool(paper_doc and paper_doc.get("paused"))
        row["submitted"] = bool(paper_doc and paper_doc.get("submitted"))
    # Attach candidate to events too
    for e in events:
        u = await db.users.find_one({"id": e["candidate_id"]}, {"_id": 0, "full_name": 1, "email": 1})
        e["candidate"] = u or {}
    return {"events": events, "risk_by_candidate": agg}


# ============================================================
# ANALYTICS
# ============================================================
@api.get("/analytics/dashboard")
async def dashboard(_=Depends(require_admin)):
    q_total = await db.questions.count_documents({})
    ex_total = await db.exams.count_documents({})
    bp_total = await db.blueprints.count_documents({})
    users_total = await db.users.count_documents({"role":"candidate"})
    papers_total = await db.papers.count_documents({})
    submissions_total = await db.results.count_documents({})
    avg_gen = await db.papers.aggregate([
        {"$group":{"_id":None,"avg":{"$avg":"$generated_in_ms"}}}
    ]).to_list(length=1)
    return {
        "questions": q_total,
        "exams": ex_total,
        "blueprints": bp_total,
        "candidates": users_total,
        "papers_generated": papers_total,
        "submissions": submissions_total,
        "avg_generation_ms": (avg_gen[0]["avg"] if avg_gen else 0) or 0,
    }


@api.get("/")
async def root():
    return {"service": "NEET AI Question Engine", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
