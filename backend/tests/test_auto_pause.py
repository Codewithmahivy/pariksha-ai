"""Tests for iteration 4: auto-pause on high risk + admin pause/unpause.

Covers only the new pause endpoints and their interaction with existing flows.
Creates its own blueprint + exam and cleans them up in class teardown.
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN = {"email": "admin@neetai.com", "password": "Admin@123"}
STUDENT = {"email": "student@neetai.com", "password": "Student@123"}


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    tok = _login(s, ADMIN)
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def candidate_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    tok = _login(s, STUDENT)
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def candidate_id(candidate_session):
    r = candidate_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def created_ids():
    return {"blueprint": None, "exam": None}


@pytest.fixture(scope="module", autouse=True)
def _cleanup(admin_session, created_ids):
    yield
    if created_ids["exam"]:
        admin_session.delete(f"{BASE_URL}/api/exams/{created_ids['exam']}")
    if created_ids["blueprint"]:
        admin_session.delete(f"{BASE_URL}/api/blueprints/{created_ids['blueprint']}")


@pytest.fixture(scope="module")
def live_exam(admin_session, candidate_session, candidate_id, created_ids):
    # Blueprint: minimal 3 questions across subjects (question bank has 365 seeded questions)
    bp_payload = {
        "name": "TEST_AutoPause_BP",
        "description": "TEST",
        "subjects": [
            {"subject": "Physics", "total_questions": 1, "difficulty_distribution": {"Easy": 1, "Medium": 0, "Hard": 0}, "chapters": [], "numerical_ratio": 0.0},
            {"subject": "Chemistry", "total_questions": 1, "difficulty_distribution": {"Easy": 1, "Medium": 0, "Hard": 0}, "chapters": [], "numerical_ratio": 0.0},
            {"subject": "Biology", "total_questions": 1, "difficulty_distribution": {"Easy": 1, "Medium": 0, "Hard": 0}, "chapters": [], "numerical_ratio": 0.0},
        ],
        "total_duration_minutes": 30,
        "marks_per_correct": 4,
        "marks_per_wrong": -1,
    }
    r = admin_session.post(f"{BASE_URL}/api/blueprints", json=bp_payload)
    assert r.status_code == 200, f"blueprint create failed: {r.status_code} {r.text}"
    bp_id = r.json()["id"]
    created_ids["blueprint"] = bp_id

    start = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
    ex_payload = {
        "name": "TEST_AutoPause_Exam",
        "blueprint_id": bp_id,
        "scheduled_start": start,
        "duration_minutes": 30,
        "description": "TEST",
    }
    r = admin_session.post(f"{BASE_URL}/api/exams", json=ex_payload)
    assert r.status_code == 200, f"exam create failed: {r.status_code} {r.text}"
    exam_id = r.json()["id"]
    created_ids["exam"] = exam_id

    # Candidate joins
    r = candidate_session.post(f"{BASE_URL}/api/exams/{exam_id}/join")
    assert r.status_code == 200, f"join failed: {r.status_code} {r.text}"
    return {"exam_id": exam_id, "blueprint_id": bp_id, "candidate_id": candidate_id, "paper": r.json()}


class TestAutoPause:
    """Auto-pause when cumulative proctor risk >= 15."""

    def test_proctor_event_returns_risk_and_auto_paused_flag(self, candidate_session, live_exam):
        exam_id = live_exam["exam_id"]
        # First event: paste_attempt (weight 5)
        r = candidate_session.post(
            f"{BASE_URL}/api/exams/{exam_id}/proctor-events",
            json={"event_type": "paste_attempt", "detail": "t1"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "risk_score" in body and "auto_paused" in body
        assert body["weight"] == 5
        assert body["risk_score"] >= 5
        assert body["auto_paused"] is False

    def test_cumulative_events_trigger_auto_pause(self, candidate_session, live_exam):
        exam_id = live_exam["exam_id"]
        # Push more events until >=15. Already 5.
        seq = [("fullscreen_exit", 4), ("fullscreen_exit", 4), ("window_blur", 2)]  # +10 => 15
        last = None
        for et, _w in seq:
            r = candidate_session.post(
                f"{BASE_URL}/api/exams/{exam_id}/proctor-events",
                json={"event_type": et, "detail": "t"},
            )
            assert r.status_code == 200, r.text
            last = r.json()
        assert last["risk_score"] >= 15, f"expected >=15, got {last}"
        assert last["auto_paused"] is True

    def test_paper_reports_paused_true_with_auto_reason(self, candidate_session, live_exam):
        r = candidate_session.get(f"{BASE_URL}/api/exams/{live_exam['exam_id']}/paper")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["paused"] is True
        assert data["pause_reason"] == "auto:high_risk"

    def test_submit_blocked_with_423_while_paused(self, candidate_session, live_exam):
        # Build an empty answers payload
        r = candidate_session.post(
            f"{BASE_URL}/api/exams/{live_exam['exam_id']}/submit",
            json={"answers": []},
        )
        assert r.status_code == 423, f"expected 423, got {r.status_code} {r.text}"
        assert "paused" in r.text.lower()

    def test_admin_events_list_shows_paused_true_submitted_false(self, admin_session, live_exam, candidate_id):
        r = admin_session.get(f"{BASE_URL}/api/exams/{live_exam['exam_id']}/proctor-events")
        assert r.status_code == 200, r.text
        data = r.json()
        rows = {row["candidate_id"]: row for row in data["risk_by_candidate"]}
        assert candidate_id in rows
        row = rows[candidate_id]
        assert row["paused"] is True
        assert row["submitted"] is False
        assert row["score"] >= 15
        assert row["risk_level"] == "HIGH"

    def test_non_admin_pause_forbidden(self, candidate_session, live_exam, candidate_id):
        r = candidate_session.post(
            f"{BASE_URL}/api/exams/{live_exam['exam_id']}/candidates/{candidate_id}/pause"
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_non_admin_unpause_forbidden(self, candidate_session, live_exam, candidate_id):
        r = candidate_session.post(
            f"{BASE_URL}/api/exams/{live_exam['exam_id']}/candidates/{candidate_id}/unpause"
        )
        assert r.status_code == 403, r.text

    def test_admin_unpause_allows_submit(self, admin_session, candidate_session, live_exam, candidate_id):
        exam_id = live_exam["exam_id"]
        r = admin_session.post(f"{BASE_URL}/api/exams/{exam_id}/candidates/{candidate_id}/unpause")
        assert r.status_code == 200, r.text
        assert r.json()["paused"] is False

        # Verify GET /paper reflects paused=false
        r = candidate_session.get(f"{BASE_URL}/api/exams/{exam_id}/paper")
        assert r.status_code == 200
        p = r.json()
        assert p["paused"] is False
        assert p["pause_reason"] in (None, "")

        # Submit some answers using questions in the paper
        answers = [{"question_id": q["id"], "selected_key": q["options"][0]["key"]} for q in p["questions"]]
        r = candidate_session.post(f"{BASE_URL}/api/exams/{exam_id}/submit", json={"answers": answers})
        assert r.status_code == 200, f"submit after unpause failed: {r.status_code} {r.text}"
        result = r.json()
        assert "score" in result and "max_score" in result
        assert isinstance(result["score"], (int, float))
        assert result["max_score"] == len(p["questions"]) * 4

    def test_admin_events_after_submit_shows_submitted_true(self, admin_session, live_exam, candidate_id):
        r = admin_session.get(f"{BASE_URL}/api/exams/{live_exam['exam_id']}/proctor-events")
        assert r.status_code == 200
        rows = {row["candidate_id"]: row for row in r.json()["risk_by_candidate"]}
        assert rows[candidate_id]["submitted"] is True


class TestAdminManualPause:
    """Admin manual pause/unpause + 404 negative cases (fresh exam, no auto-pause)."""

    @pytest.fixture(scope="class")
    def manual_exam(self, admin_session, candidate_session):
        # Reuse the seeded 365 question bank via a fresh blueprint+exam scoped to this class
        bp_payload = {
            "name": "TEST_ManualPause_BP",
            "description": "TEST",
            "subjects": [
                {"subject": "Physics", "total_questions": 1, "difficulty_distribution": {"Easy": 1, "Medium": 0, "Hard": 0}, "chapters": [], "numerical_ratio": 0.0},
            ],
            "total_duration_minutes": 30,
            "marks_per_correct": 4,
            "marks_per_wrong": -1,
        }
        r = admin_session.post(f"{BASE_URL}/api/blueprints", json=bp_payload)
        assert r.status_code == 200, r.text
        bp_id = r.json()["id"]

        start = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        r = admin_session.post(f"{BASE_URL}/api/exams", json={
            "name": "TEST_ManualPause_Exam",
            "blueprint_id": bp_id,
            "scheduled_start": start,
            "duration_minutes": 30,
        })
        assert r.status_code == 200, r.text
        exam_id = r.json()["id"]

        # Join candidate to create a paper
        r = candidate_session.post(f"{BASE_URL}/api/exams/{exam_id}/join")
        assert r.status_code == 200, r.text

        yield {"exam_id": exam_id, "blueprint_id": bp_id}

        admin_session.delete(f"{BASE_URL}/api/exams/{exam_id}")
        admin_session.delete(f"{BASE_URL}/api/blueprints/{bp_id}")

    def test_admin_manual_pause_sets_reason(self, admin_session, candidate_session, manual_exam, candidate_id):
        exam_id = manual_exam["exam_id"]
        r = admin_session.post(f"{BASE_URL}/api/exams/{exam_id}/candidates/{candidate_id}/pause")
        assert r.status_code == 200, r.text
        assert r.json()["paused"] is True

        r = candidate_session.get(f"{BASE_URL}/api/exams/{exam_id}/paper")
        assert r.status_code == 200
        data = r.json()
        assert data["paused"] is True
        assert data["pause_reason"] == "admin:manual"

    def test_admin_manual_unpause(self, admin_session, candidate_session, manual_exam, candidate_id):
        exam_id = manual_exam["exam_id"]
        r = admin_session.post(f"{BASE_URL}/api/exams/{exam_id}/candidates/{candidate_id}/unpause")
        assert r.status_code == 200
        assert r.json()["paused"] is False

        r = candidate_session.get(f"{BASE_URL}/api/exams/{exam_id}/paper")
        assert r.json()["paused"] is False

    def test_pause_unknown_candidate_returns_404(self, admin_session, manual_exam):
        r = admin_session.post(
            f"{BASE_URL}/api/exams/{manual_exam['exam_id']}/candidates/does-not-exist-uuid/pause"
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_pause_unknown_exam_returns_404(self, admin_session, candidate_id):
        r = admin_session.post(
            f"{BASE_URL}/api/exams/no-such-exam/candidates/{candidate_id}/pause"
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"


class TestRegression:
    """Existing flows must still work."""

    def test_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_analytics_dashboard(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("exams", "blueprints"):
            assert k in data
