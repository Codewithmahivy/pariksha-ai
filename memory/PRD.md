# PRD: NEET AI Question Generation Engine

## Original Problem Statement
Build an AI-powered question generation engine capable of managing a massive question bank containing millions of NEET-level questions across Physics, Chemistry, and Biology. Before every exam, AI should automatically analyze the exam blueprint, subject-wise weightage, chapter distribution, difficulty levels (Easy, Medium, Hard), previous-year trends, and learning objectives. At the exact moment the exam begins, the system should generate a unique encrypted question paper for every candidate by intelligently selecting different questions while maintaining the same overall difficulty, syllabus coverage, and fairness. No question paper should exist before the exam starts, eliminating the possibility of paper leaks. The AI should also avoid duplicate questions, balance numerical and theoretical questions, ensure proper topic coverage, and generate a secure paper within milliseconds for thousands or millions of candidates simultaneously.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Files: `server.py`, `models.py`, `auth.py`, `paper_engine.py`, `ai_service.py`, `seed_data.py`
- **Frontend**: React + shadcn/ui + TailwindCSS + Recharts. Dual-theme: dark admin, light candidate exam room.
- **AI**: Gemini 3 Flash via `emergentintegrations` (Emergent Universal LLM Key)
- **Auth**: JWT + bcrypt. Roles: `admin`, `candidate`. Seeded users: admin@neetai.com / Admin@123, student@neetai.com / Student@123
- **Security**: AES-GCM per-candidate encryption. Keys derived from `PAPER_ENCRYPTION_SECRET + exam_id + candidate_id` (SHA-256). Plaintext paper never persisted.

## Personas
1. **Exam Admin**: Manages question bank, blueprints, schedules exams, monitors live paper forge, views leaderboards.
2. **Candidate**: Sees upcoming exams, joins at start, receives encrypted paper generated on the fly, takes the exam, sees results.

## What's Implemented (Feb 2026)
- JWT auth with Admin + Candidate roles, seeded demo accounts
- Question bank: filter/search, seed 180 demo questions, AI generate via Gemini 3 Flash, CSV upload
- Blueprint CRUD (subject weightage, difficulty distribution, numerical ratio, marking scheme)
- Exam CRUD with computed live/scheduled/ended status
- **Paper forge**: Runs at exam start using MongoDB `$sample` for fairness across subjects/difficulty/chapter/type; per-candidate seeded option-shuffle + question order; AES-GCM encryption
- Candidate exam room: timer with warning states, question palette (answered/marked/current), review/mark, auto-submit on timeout, confirmation dialog
- Results: score breakdown, subject-wise chart, per-question review with explanations
- Admin live monitor: papers generated, avg/min/max gen time, candidate join velocity chart, recent papers table, leaderboard
- Landing page with hero, live paper forge sequence timeline

## Backlog (P1/P2)
- P1: Object storage / image upload for questions with diagrams
- P1: Bulk exam invitations by email
- P1: Test analytics (avg score per exam, trending topics)
- P2: Multi-language question support
- P2: Adaptive difficulty per candidate based on past performance
- P2: WebSocket live updates for admin monitor (currently 3s polling)
