"""Backend E2E tests for NEET AI Question Generation Engine."""
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@neetai.com", "password": "Admin@123"}
STUDENT = {"email": "student@neetai.com", "password": "Student@123"}


# ---------- Shared state within a class scope (loadscope binds class to one worker) ----------
@pytest.fixture(scope="class")
def state():
    return {}


@pytest.fixture(scope="class")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="class")
def student_token():
    r = requests.post(f"{API}/auth/login", json=STUDENT, timeout=30)
    assert r.status_code == 200, f"student login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# =========================================================
# 1. Health + Auth
# =========================================================
class TestHealthAndAuth:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"

    def test_admin_login_and_me(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN["email"]
        token = data["access_token"]
        m = requests.get(f"{API}/auth/me", headers=auth(token), timeout=15)
        assert m.status_code == 200
        assert m.json()["email"] == ADMIN["email"]

    def test_student_login_and_me(self):
        r = requests.post(f"{API}/auth/login", json=STUDENT, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "candidate"
        token = data["access_token"]
        m = requests.get(f"{API}/auth/me", headers=auth(token), timeout=15)
        assert m.status_code == 200
        assert m.json()["role"] == "candidate"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)

    def test_register_new_candidate(self):
        email = f"TEST_cand_{int(time.time()*1000)}@test.io"
        payload = {"email": email, "password": "Passw0rd!", "full_name": "TEST Cand", "role": "candidate"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email
        assert d["access_token"]
        # verify token works
        m = requests.get(f"{API}/auth/me", headers=auth(d["access_token"]), timeout=15)
        assert m.status_code == 200


# =========================================================
# 2. Questions
# =========================================================
class TestQuestions:
    def test_meta(self, admin_token):
        r = requests.get(f"{API}/questions/meta", headers=auth(admin_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 180, f"expected >=180 seeded questions, got {d['total']}"
        for s in ["Physics", "Chemistry", "Biology"]:
            assert d["by_subject"].get(s, 0) > 0, f"no questions in {s}"
        for diff in ["Easy", "Medium", "Hard"]:
            assert d["by_difficulty"].get(diff, 0) > 0
        assert "chapters" in d
        for s in ["Physics", "Chemistry", "Biology"]:
            assert s in d["chapters"] and len(d["chapters"][s]) > 0

    def test_seed_forbidden_for_candidate(self, student_token):
        r = requests.post(f"{API}/questions/seed-demo", json={"per_subject": 1}, headers=auth(student_token), timeout=20)
        assert r.status_code == 403

    def test_filter_questions(self, admin_token):
        r = requests.get(f"{API}/questions?subject=Physics&difficulty=Easy&limit=20", headers=auth(admin_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] > 0
        for it in d["items"]:
            assert it["subject"] == "Physics"
            assert it["difficulty"] == "Easy"

    def test_ai_generate(self, admin_token):
        payload = {"subject": "Physics", "chapter": "Kinematics", "difficulty": "Easy", "count": 2}
        r = requests.post(f"{API}/questions/generate-ai", json=payload, headers=auth(admin_token), timeout=90)
        if r.status_code == 500:
            pytest.skip(f"AI service flake: {r.text[:200]}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["generated"] >= 1
        assert d["elapsed_ms"] > 0
        for q in d["items"]:
            assert q["subject"] == "Physics"
            assert q["chapter"] == "Kinematics"


# =========================================================
# 3. End-to-end Exam flow (blueprint -> exam -> join -> paper -> submit -> result -> monitor)
# =========================================================
class TestExamE2E:
    def test_candidate_cannot_create_blueprint(self, student_token, state):
        bp_payload = self._blueprint_payload()
        r = requests.post(f"{API}/blueprints", json=bp_payload, headers=auth(student_token), timeout=15)
        assert r.status_code == 403

    def test_admin_creates_blueprint(self, admin_token, state):
        r = requests.post(f"{API}/blueprints", json=self._blueprint_payload(), headers=auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        bp = r.json()
        assert bp["id"]
        assert len(bp["subjects"]) == 3
        state["blueprint_id"] = bp["id"]

        # list
        lst = requests.get(f"{API}/blueprints", headers=auth(admin_token), timeout=15)
        assert lst.status_code == 200
        ids = [x["id"] for x in lst.json()["items"]]
        assert bp["id"] in ids

    def test_admin_creates_live_exam(self, admin_token, state):
        assert "blueprint_id" in state
        start = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        payload = {
            "name": "TEST NEET Live",
            "blueprint_id": state["blueprint_id"],
            "scheduled_start": start,
            "duration_minutes": 60,
            "description": "test",
        }
        r = requests.post(f"{API}/exams", json=payload, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        ex = r.json()
        state["exam_id"] = ex["id"]

        lst = requests.get(f"{API}/exams", headers=auth(admin_token), timeout=15)
        found = next((e for e in lst.json()["items"] if e["id"] == ex["id"]), None)
        assert found is not None
        assert found["computed_status"] == "live"

    def test_future_exam_join_returns_400(self, admin_token, student_token, state):
        start = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        payload = {
            "name": "TEST Future",
            "blueprint_id": state["blueprint_id"],
            "scheduled_start": start,
            "duration_minutes": 30,
        }
        r = requests.post(f"{API}/exams", json=payload, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        future_id = r.json()["id"]
        state["future_exam_id"] = future_id

        r2 = requests.post(f"{API}/exams/{future_id}/join", headers=auth(student_token), timeout=15)
        assert r2.status_code == 400, r2.text

    def test_candidate_joins_and_paper_forge(self, student_token, state):
        exam_id = state["exam_id"]
        r = requests.post(f"{API}/exams/{exam_id}/join", headers=auth(student_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paper_id"]
        assert d["encrypted_payload"]
        assert d["nonce"]
        assert d["generated_in_ms"] > 0
        assert d["already_joined"] is False
        state["paper_id"] = d["paper_id"]
        state["first_gen_ms"] = d["generated_in_ms"]
        state["encrypted_payload"] = d["encrypted_payload"]

    def test_join_is_idempotent(self, student_token, state):
        r = requests.post(f"{API}/exams/{state['exam_id']}/join", headers=auth(student_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["paper_id"] == state["paper_id"]
        assert d["already_joined"] is True
        assert d["encrypted_payload"] == state["encrypted_payload"]

    def test_get_paper_hides_answers(self, student_token, state):
        r = requests.get(f"{API}/exams/{state['exam_id']}/paper", headers=auth(student_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["questions"]) == 18, f"expected 18 questions got {len(d['questions'])}"
        subj_count = {"Physics": 0, "Chemistry": 0, "Biology": 0}
        qids = []
        for q in d["questions"]:
            assert "correct_key" not in q, "correct_key leaked to candidate"
            assert "explanation" not in q, "explanation leaked to candidate"
            assert q["subject"] in subj_count
            subj_count[q["subject"]] += 1
            qids.append(q["id"])
        for s, c in subj_count.items():
            assert c == 6, f"expected 6 per subject, got {s}={c}"
        # duplicate check
        assert len(set(qids)) == len(qids), "duplicate question ids in paper"
        state["question_ids"] = qids

    def test_submit_scores_correctly(self, student_token, state):
        # Submit "A" for all questions
        answers = [{"question_id": qid, "selected_key": "A"} for qid in state["question_ids"]]
        r = requests.post(
            f"{API}/exams/{state['exam_id']}/submit",
            json={"answers": answers},
            headers=auth(student_token), timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["max_score"] == 72, f"expected max 72 got {d['max_score']}"
        total = d["correct"] + d["wrong"] + d["unattempted"]
        assert total == 18
        expected = d["correct"] * 4 + d["wrong"] * -1
        assert d["score"] == expected, f"score {d['score']} != {expected}"
        assert "subject_breakdown" in d
        for s in ["Physics", "Chemistry", "Biology"]:
            assert s in d["subject_breakdown"]
            assert d["subject_breakdown"][s]["total"] == 6

    def test_second_submit_fails(self, student_token, state):
        answers = [{"question_id": qid, "selected_key": "A"} for qid in state["question_ids"]]
        r = requests.post(
            f"{API}/exams/{state['exam_id']}/submit",
            json={"answers": answers},
            headers=auth(student_token), timeout=15,
        )
        assert r.status_code == 400
        assert "already" in r.text.lower() or "submitted" in r.text.lower()

    def test_result_reveals_keys(self, student_token, state):
        r = requests.get(f"{API}/exams/{state['exam_id']}/result", headers=auth(student_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "subject_breakdown" in d
        assert "review" in d and len(d["review"]) == 18
        for item in d["review"]:
            assert "correct_key" in item and item["correct_key"] in ("A", "B", "C", "D")
            assert "explanation" in item

    def test_monitor(self, admin_token, state):
        r = requests.get(f"{API}/exams/{state['exam_id']}/monitor", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["papers_generated"] >= 1
        assert d["submitted"] >= 1
        assert d["avg_generation_ms"] > 0
        assert "recent_papers" in d
        for p in d["recent_papers"]:
            assert "encrypted_payload" not in p, "encrypted_payload leaked in monitor"

    def test_monitor_forbidden_for_candidate(self, student_token, state):
        r = requests.get(f"{API}/exams/{state['exam_id']}/monitor", headers=auth(student_token), timeout=15)
        assert r.status_code == 403

    def test_analytics_dashboard(self, admin_token):
        r = requests.get(f"{API}/analytics/dashboard", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["questions", "exams", "blueprints", "candidates", "papers_generated", "submissions", "avg_generation_ms"]:
            assert k in d
        assert d["questions"] >= 180
        assert d["papers_generated"] >= 1
        assert d["submissions"] >= 1
        assert d["avg_generation_ms"] > 0

    def test_analytics_forbidden_for_candidate(self, student_token):
        r = requests.get(f"{API}/analytics/dashboard", headers=auth(student_token), timeout=15)
        assert r.status_code == 403

    # ---------- helpers ----------
    @staticmethod
    def _blueprint_payload():
        subjects = []
        for s in ["Physics", "Chemistry", "Biology"]:
            subjects.append({
                "subject": s,
                "total_questions": 6,
                "difficulty_distribution": {"Easy": 2, "Medium": 2, "Hard": 2},
                "chapters": [],
                "numerical_ratio": 0.3,
            })
        return {
            "name": "TEST Blueprint E2E",
            "description": "auto-test",
            "subjects": subjects,
            "total_duration_minutes": 60,
            "marks_per_correct": 4,
            "marks_per_wrong": -1,
        }


# =========================================================
# Cleanup
# =========================================================
@pytest.fixture(scope="module", autouse=True)
def cleanup(request):
    yield
    try:
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        if r.status_code != 200:
            return
        token = r.json()["access_token"]
        h = auth(token)
        exams = requests.get(f"{API}/exams", headers=h, timeout=15).json().get("items", [])
        for ex in exams:
            if ex.get("name", "").startswith("TEST "):
                requests.delete(f"{API}/exams/{ex['id']}", headers=h, timeout=15)
        bps = requests.get(f"{API}/blueprints", headers=h, timeout=15).json().get("items", [])
        for bp in bps:
            if bp.get("name", "").startswith("TEST "):
                requests.delete(f"{API}/blueprints/{bp['id']}", headers=h, timeout=15)
    except Exception as e:
        print(f"cleanup error: {e}")
