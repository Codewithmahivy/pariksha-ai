"""AI question generation via Gemini 3 Flash (Emergent Universal LLM Key)."""
import os
import json
import re
import uuid
from datetime import datetime, timezone
from google import genai
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = """You are an expert NEET (National Eligibility cum Entrance Test) question setter for Indian medical entrance exams.
You create rigorous, exam-quality MCQs strictly at NEET UG level, aligned with NCERT syllabus for Physics, Chemistry, and Biology.

Requirements for every question:
- 4 options labeled A, B, C, D with EXACTLY one correct answer.
- Difficulty must match requested level (Easy = direct recall, Medium = conceptual application, Hard = multi-step/tricky).
- If q_type is Numerical: include numerical values, units, and require calculation. Otherwise theoretical/conceptual.
- Explanation must justify the correct answer in 2-4 sentences with the exact NCERT concept.
- Do NOT repeat concepts across questions in the same batch.
- Return STRICT JSON only, no markdown, no commentary.

Response schema (a JSON object with a "questions" array):
{
  "questions": [
    {
      "text": "...",
      "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
      "correct_key": "A",
      "explanation": "...",
      "topic": "...",
      "tags": ["..."]
    }
  ]
}
"""

async def generate_questions_ai(
    subject: str,
    chapter: str,
    topic: str,
    difficulty: str,
    q_type: str,
    count: int,
) -> list:

    prompt = f"""
{SYSTEM_PROMPT}

Generate {count} unique NEET-level MCQs.

Subject: {subject}
Chapter: {chapter}
Topic focus: {topic or "any core concept from the chapter"}
Difficulty: {difficulty}
Question Type: {q_type}

Return STRICT JSON only matching the schema.
Do not include markdown or code fences.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    response_text = response.text.strip()

    # Extract JSON (strip code fences if any)
    m = re.search(r"\{[\s\S]*\}\s*$", response_text)

    if m:
        json_str = m.group(0)
    else:
        json_str = response_text

    json_str = re.sub(r"^```(?:json)?", "", json_str).strip()
    json_str = re.sub(r"```$", "", json_str).strip()

    data = json.loads(json_str)
    raw_questions = data.get("questions", [])

    out = []

    for rq in raw_questions:
        if not rq.get("options") or len(rq["options"]) < 4:
            continue

        out.append({
            "id": str(uuid.uuid4()),
            "subject": subject,
            "chapter": chapter,
            "topic": rq.get("topic", topic or chapter),
            "difficulty": difficulty,
            "q_type": q_type,
            "text": rq["text"],
            "options": rq["options"][:4],
            "correct_key": rq["correct_key"],
            "explanation": rq.get("explanation", ""),
            "tags": rq.get("tags", []),
            "is_previous_year": False,
            "previous_year": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": "ai",
        })

    return out
