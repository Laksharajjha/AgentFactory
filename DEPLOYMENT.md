# PROJECT FORGE 3.0 — Production Deployment & Infrastructure Guide

PROJECT FORGE 3.0 is an enterprise autonomous AI workforce platform combining a preserved 3D architectural office with multi-tenant workspace isolation, universal artifact generation, GitHub repository sandboxes, a verifiable agent tool registry, and a fair execution resource governor.

---

## 1. Production Architecture Topology

| Component | Target Service | Purpose |
| :--- | :--- | :--- |
| **Frontend Web Application** | Vercel / Cloudflare Pages | React 18 + Three.js + React Three Fiber 3D Office & Enterprise Workspace Shell |
| **Backend API & WebSocket Server** | Render / Railway / Fly.io (FastAPI + Uvicorn) | REST API, WebSocket real-time state stream, Authentication, RBAC, Artifact Engine |
| **Execution Worker & Governor** | Render / Railway Background Worker (or Co-located Lifespan Loop) | Fair Execution Queue, Resource Governor, Isolated Repository Sandboxes, Lease Heartbeats |
| **Authoritative Database** | **Neon Serverless PostgreSQL** | Multi-tenant relational storage, JSONB payloads, Row-Level Security (RLS) policies, Alembic migrations |
| **Coordination & Rate Limit Cache** | **Upstash Redis** (Optional, with DB fallback) | Distributed rate limiting, lease locks, WebSocket pub/sub |
| **Deliverable Object Storage** | **Cloudflare R2 / AWS S3 / Supabase Storage** (with local tenant-isolated fallback) | Versioned binary & text deliverables (`.pptx`, `.docx`, `.xlsx`, `.pdf`, `.csv`, `.md`, `.zip`, `.svg`, `.png`) |

---

## 2. Environment Variables (`backend/.env`)

Configure the following environment variables on your backend API and worker instances:

```ini
# --- Core Application ---
APP_NAME="PROJECT FORGE"
APP_VERSION="3.0.0"
HOST="0.0.0.0"
PORT="8000"

# --- Authoritative Database (Neon Serverless PostgreSQL) ---
# Pooled connection string for runtime queries:
DATABASE_URL="postgresql+asyncpg://user:password@ep-example-pooler.us-east-2.aws.neon.tech/neondb?ssl=require"
# Direct connection string for Alembic schema migrations:
DIRECT_DATABASE_URL="postgresql+asyncpg://user:password@ep-example.us-east-2.aws.neon.tech/neondb?ssl=require"

# --- Security & Cryptography ---
JWT_SECRET_KEY="<generate-64-char-random-hex-secret>"
FERNET_SECRET_KEY="<generate-url-safe-base64-32-byte-key>"
ARTIFACT_SIGNING_SECRET="<generate-64-char-hmac-sha256-secret>"
ACCESS_TOKEN_EXPIRE_MINUTES="1440"
REFRESH_TOKEN_EXPIRE_DAYS="14"

# --- Google Gemini API & Free-Tier Rate Limiter ---
GEMINI_API_KEY="<your-server-side-gemini-api-key>"
GEMINI_MODEL="gemini-3.1-flash-lite-preview"
GEMINI_FALLBACK_MODEL="gemini-2.5-flash-lite"
ENABLE_LIVE_GEMINI_EXECUTION="false"
GLOBAL_TOKEN_BUDGET="100000"

# --- Resource Governor & Fair Queue ---
MAX_CONCURRENT_WORKFORCES="2"
MAX_CONCURRENT_EXECUTIONS_PER_USER="1"
MAX_QUEUED_WORKFORCES_PER_USER="3"
MAX_GLOBAL_QUEUED_WORKFORCES="10"
EXECUTION_LEASE_SECONDS="60"
EXECUTION_HEARTBEAT_SECONDS="15"

# --- Object Storage & Isolated Workspaces ---
ARTIFACT_STORAGE_PROVIDER="local" # or "s3" for Cloudflare R2 / AWS S3
ARTIFACT_STORAGE_DIR="./storage/artifacts"
WORKSPACE_SANDBOX_DIR="./storage/workspaces"
S3_ENDPOINT_URL="https://<account-id>.r2.cloudflarestorage.com"
S3_BUCKET_NAME="forge-artifacts"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""

# --- Upstash Redis (Optional) ---
REDIS_URL="rediss://default:<password>@<endpoint>.upstash.io:6379"
```

Configure the following environment variables on your frontend build (`frontend/.env.production`):

```ini
VITE_API_BASE_URL="https://api.your-forge-domain.com"
VITE_WS_BASE_URL="wss://api.your-forge-domain.com"
```

---

## 3. Database Schema & Non-Destructive Migration (SQLite -> Neon PostgreSQL)

### 3.1 Running Alembic Migrations on Neon PostgreSQL

```bash
cd backend
export DATABASE_URL="postgresql+asyncpg://user:password@ep-example.us-east-2.aws.neon.tech/neondb?ssl=require"
./.venv/bin/alembic upgrade head
```

This creates all 36 PROJECT FORGE 3.0 tables across all 7 domains (`identity`, `office_core`, `projects`, `artifacts`, `github_workspaces`, `tools`, `scheduler`) and installs PostgreSQL Row-Level Security (`RLS`) policies for tenant-scoped tables.

### 3.2 Migrating Existing SQLite Data to Neon PostgreSQL

To migrate existing rooms, AI employees, memories, tasks, boardroom meetings, and world events from `backend/project_forge.db` to Neon PostgreSQL without losing any state:

```bash
cd backend
./.venv/bin/python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path ./project_forge.db \
  --postgres-url "postgresql+asyncpg://user:password@ep-example.us-east-2.aws.neon.tech/neondb?ssl=require"
```

The migration script:
1. Provisions the default system organization and workspace if not present.
2. Upserts all existing rows (`rooms`, `agents`, `agent_memories`, `tasks`, `meetings`, `meeting_messages`, `presentations`, `events`, `workforce_configs`) idempotently.
3. Verifies and prints source vs. target row counts for every table.

---

## 4. Worker Process, Lease Heartbeats & Stale Recovery

The `ResourceGovernor` (`backend/app/scheduler/resource_governor.py`) runs a background reconciliation loop every 5 seconds:
- Renews execution leases (`execution_leases`) for active worker tasks every `EXECUTION_HEARTBEAT_SECONDS` (15s).
- Detects expired leases (`expires_at < utcnow()`) from crashed or restarted workers, recovers orphaned executions, and re-admits queued jobs using round-robin fairness (`FairnessPolicy`) across distinct users.

---

## 5. Health Check & Acceptance Verification

### 5.1 Health Check Endpoint
- **`GET /api/health`**: Returns database connectivity, active AI execution mode (`DEMO MODE` vs `LIVE GEMINI MODE`), active model quotas, and platform version `3.0.0`.

### 5.2 Automated End-to-End Acceptance Suite (Workflows A–J)
Run the comprehensive automated verification suite at any time:

```bash
PYTHONPATH=backend ./backend/.venv/bin/python backend/tests/test_forge_3_0_workflows.py
```
