"""Pydantic models for NEET AI Question Generation Engine."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Literal
from datetime import datetime, timezone
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: Literal["admin", "candidate"] = "candidate"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------- Question ----------
Subject = Literal["Physics", "Chemistry", "Biology"]
Difficulty = Literal["Easy", "Medium", "Hard"]
QType = Literal["Numerical", "Theoretical"]


class QuestionOption(BaseModel):
    key: str  # "A"/"B"/"C"/"D"
    text: str


class QuestionCreate(BaseModel):
    subject: Subject
    chapter: str
    topic: str = ""
    difficulty: Difficulty
    q_type: QType = "Theoretical"
    text: str
    options: List[QuestionOption]
    correct_key: str  # "A"..."D"
    explanation: str = ""
    tags: List[str] = []
    is_previous_year: bool = False
    previous_year: Optional[int] = None


class Question(QuestionCreate):
    id: str = Field(default_factory=_uuid)
    created_at: str = Field(default_factory=_now_iso)
    created_by: Optional[str] = None
    source: str = "manual"  # manual | ai | csv


# ---------- Blueprint ----------
class SubjectSpec(BaseModel):
    subject: Subject
    total_questions: int
    difficulty_distribution: Dict[str, int]  # {"Easy":n,"Medium":n,"Hard":n}
    chapters: List[str] = []  # optional filter
    numerical_ratio: float = 0.3  # fraction of numerical questions


class BlueprintCreate(BaseModel):
    name: str
    description: str = ""
    subjects: List[SubjectSpec]
    total_duration_minutes: int = 180
    marks_per_correct: int = 4
    marks_per_wrong: int = -1


class Blueprint(BlueprintCreate):
    id: str = Field(default_factory=_uuid)
    created_at: str = Field(default_factory=_now_iso)
    created_by: Optional[str] = None


# ---------- Exam ----------
class ExamCreate(BaseModel):
    name: str
    blueprint_id: str
    scheduled_start: str  # ISO datetime
    duration_minutes: int = 180
    description: str = ""


class Exam(ExamCreate):
    id: str = Field(default_factory=_uuid)
    status: Literal["scheduled", "live", "ended"] = "scheduled"
    created_at: str = Field(default_factory=_now_iso)
    created_by: Optional[str] = None


# ---------- Paper Instance ----------
class PaperInstance(BaseModel):
    id: str = Field(default_factory=_uuid)
    exam_id: str
    candidate_id: str
    question_ids: List[str]
    encrypted_payload: str  # base64 AES-GCM ciphertext
    nonce: str
    generated_at: str = Field(default_factory=_now_iso)
    generated_in_ms: float = 0.0
    submitted: bool = False


class SubmitAnswer(BaseModel):
    question_id: str
    selected_key: Optional[str] = None


class SubmitExam(BaseModel):
    answers: List[SubmitAnswer]


class ExamResult(BaseModel):
    id: str = Field(default_factory=_uuid)
    exam_id: str
    candidate_id: str
    paper_id: str
    score: float
    max_score: float
    correct: int
    wrong: int
    unattempted: int
    subject_breakdown: Dict[str, Dict[str, float]]
    submitted_at: str = Field(default_factory=_now_iso)


# ---------- AI Generation ----------
class AIGenRequest(BaseModel):
    subject: Subject
    chapter: str
    topic: str = ""
    difficulty: Difficulty = "Medium"
    q_type: QType = "Theoretical"
    count: int = Field(default=5, ge=1, le=15)


class DemoSeedRequest(BaseModel):
    per_subject: int = 60  # per subject


# ---------- Proctoring ----------
ProctorEventType = Literal[
    "tab_hidden", "window_blur", "paste_attempt", "copy_attempt",
    "context_menu", "fullscreen_exit", "rapid_switch",
]


class ProctorEventCreate(BaseModel):
    event_type: ProctorEventType
    detail: str = ""


class ProctorEvent(ProctorEventCreate):
    id: str = Field(default_factory=_uuid)
    exam_id: str
    candidate_id: str
    created_at: str = Field(default_factory=_now_iso)
    weight: int = 1
