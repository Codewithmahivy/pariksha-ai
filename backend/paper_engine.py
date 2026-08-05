"""
Paper Generation Engine:
- Fairness algorithm: samples questions per subject/difficulty/chapter using MongoDB $sample
- Per-candidate deterministic option shuffle
- AES-GCM encryption per candidate (no paper stored in plaintext)
"""
import os
import time
import json
import base64
import hashlib
import random
from typing import List, Dict, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MASTER_SECRET = os.environ["PAPER_ENCRYPTION_SECRET"].encode("utf-8")


def _derive_key(exam_id: str, candidate_id: str) -> bytes:
    """Derive a 32-byte AES key from master secret + exam + candidate."""
    h = hashlib.sha256()
    h.update(MASTER_SECRET)
    h.update(b"::")
    h.update(exam_id.encode())
    h.update(b"::")
    h.update(candidate_id.encode())
    return h.digest()


def encrypt_paper(exam_id: str, candidate_id: str, payload: dict) -> Dict[str, str]:
    key = _derive_key(exam_id, candidate_id)
    aes = AESGCM(key)
    nonce = os.urandom(12)
    plaintext = json.dumps(payload).encode("utf-8")
    ct = aes.encrypt(nonce, plaintext, exam_id.encode())
    return {
        "ciphertext": base64.b64encode(ct).decode(),
        "nonce": base64.b64encode(nonce).decode(),
    }


def decrypt_paper(exam_id: str, candidate_id: str, ciphertext_b64: str, nonce_b64: str) -> dict:
    key = _derive_key(exam_id, candidate_id)
    aes = AESGCM(key)
    ct = base64.b64decode(ciphertext_b64)
    nonce = base64.b64decode(nonce_b64)
    plaintext = aes.decrypt(nonce, ct, exam_id.encode())
    return json.loads(plaintext.decode())


async def build_paper_for_candidate(
    db,
    exam: dict,
    blueprint: dict,
    candidate_id: str,
) -> Dict[str, Any]:
    """
    Sample unique questions across subjects/difficulties/chapters per blueprint.
    Returns list of full question dicts + timing.
    """
    t0 = time.perf_counter()
    all_questions: List[dict] = []
    selected_ids: set = set()

    # Per-candidate seed => deterministic option shuffle for this candidate
    seed_val = int(hashlib.sha256(f"{exam['id']}:{candidate_id}".encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed_val)

    for spec in blueprint["subjects"]:
        subject = spec["subject"]
        diff_dist: Dict[str, int] = spec["difficulty_distribution"]
        chapter_filter = spec.get("chapters") or []
        numerical_ratio = float(spec.get("numerical_ratio", 0.3))

        for difficulty, count in diff_dist.items():
            if count <= 0:
                continue
            n_numerical = max(0, int(round(count * numerical_ratio)))
            n_theoretical = count - n_numerical

            for q_type, want in (("Numerical", n_numerical), ("Theoretical", n_theoretical)):
                if want <= 0:
                    continue
                match: Dict[str, Any] = {
                    "subject": subject,
                    "difficulty": difficulty,
                    "q_type": q_type,
                }
                if chapter_filter:
                    match["chapter"] = {"$in": chapter_filter}
                if selected_ids:
                    match["id"] = {"$nin": list(selected_ids)}

                pipeline = [
                    {"$match": match},
                    {"$sample": {"size": want}},
                    {"$project": {"_id": 0}},
                ]
                found = await db.questions.aggregate(pipeline).to_list(length=want)

                # Fallback: relax q_type if not enough numerical/theoretical questions
                if len(found) < want:
                    remaining = want - len(found)
                    got_ids = {q["id"] for q in found}
                    match_relaxed = {
                        "subject": subject,
                        "difficulty": difficulty,
                        "id": {"$nin": list(selected_ids | got_ids)},
                    }
                    if chapter_filter:
                        match_relaxed["chapter"] = {"$in": chapter_filter}
                    extra = await db.questions.aggregate([
                        {"$match": match_relaxed},
                        {"$sample": {"size": remaining}},
                        {"$project": {"_id": 0}},
                    ]).to_list(length=remaining)
                    found.extend(extra)

                for q in found:
                    selected_ids.add(q["id"])
                    all_questions.append(q)

    # Shuffle final question order per candidate
    rng.shuffle(all_questions)

    # Shuffle option order per candidate (remap correct_key)
    for q in all_questions:
        opts = list(q["options"])
        correct_key = q["correct_key"]
        # Attach original correctness before shuffle
        for o in opts:
            o["_is_correct"] = (o["key"] == correct_key)
        rng.shuffle(opts)
        # Reassign keys A,B,C,D in new order
        letters = ["A", "B", "C", "D", "E", "F"]
        new_correct = None
        for idx, o in enumerate(opts):
            o["key"] = letters[idx]
            if o.pop("_is_correct", False):
                new_correct = o["key"]
        q["options"] = opts
        q["correct_key"] = new_correct

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {"questions": all_questions, "generated_in_ms": elapsed_ms}
