# PROJECT FORGE — Autonomous 3D AI Technology Company

PROJECT FORGE is an interactive 3D architectural office and autonomous AI workforce engine built with **Three.js / React Three Fiber**, **FastAPI**, **Google GenAI SDK (Gemini)**, **SQLite (async SQLAlchemy)**, and **WebSockets**.

---

## Quick Start

### 1. Backend (FastAPI + Gemini Gateway + SQLite World Engine)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: configure your Gemini API Key in .env or via the in-app Settings modal
cp .env.example .env

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend (Vite + React Three Fiber + TypeScript + Zustand)

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your desktop browser.

---

## Environment Variables (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `""` | Official Google Gemini API Key (kept strictly server-side; can also be set live via the UI Settings modal) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary Gemini model used for routine agent reasoning |
| `GEMINI_COMPLEX_MODEL` | `gemini-2.5-pro` | Complex model used when `ENABLE_COMPLEX_MODEL=true` |
| `MAX_AGENT_ITERATIONS` | `5` | Maximum reasoning iterations per agent per workforce |
| `MAX_WORKFORCE_CALLS` | `30` | Maximum total LLM calls per workforce |
| `MAX_OUTPUT_TOKENS` | `1024` | Default output token ceiling per ordinary LLM call |
| `MAX_RETRIES` | `2` | Maximum retries on transient API errors |
| `GLOBAL_TOKEN_BUDGET` | `100000` | Global workforce token budget ceiling |
| `PER_AGENT_TOKEN_BUDGET` | `15000` | Default per-agent token budget ceiling |
| `DATABASE_URL` | `sqlite+aiosqlite:///./project_forge.db` | Async SQLite persistence URL |
