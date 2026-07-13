# Eleven Nodes Backend

FastAPI service for Eleven Nodes configuration, workflow, agent, and execution APIs.

## Local setup

```bash
# From the repository root, create the PostgreSQL database.
docker compose up -d postgres

cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`. Interactive documentation is at
`http://localhost:8000/docs`.

## Health check

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"healthy","service":"eleven-nodes-api"}
```

## Database

PostgreSQL is the source of truth for users, workspaces, workspace memberships,
pages, and workflow JSON. The default local connection is:

```text
postgresql+psycopg://clovai:clovai@localhost:5432/clovai
```

Override `DATABASE_URL` in `backend/.env` for another environment. Apply schema
changes with Alembic rather than creating tables from application startup:

```bash
cd backend
alembic upgrade head
```

The initial migration creates:

- `users`
- `workspaces`
- `workspace_members`
- `pages`
- `workflows` (`definition` is PostgreSQL `JSONB`)

## Workflow runtime

The workflow API uses the JSON definition saved in PostgreSQL as its source of truth:

```bash
# 1. Save JSON
curl -X PUT http://localhost:8000/api/workflows/{workspaceId}/pages/{pageId} \
  -H 'Content-Type: application/json' --data @workflow.json

# 2. Validate JSON, agent/tool references, and the DAG
curl -X POST http://localhost:8000/api/workflows/{workspaceId}/pages/{pageId}/validate

# 3. Test graph execution without making model calls
curl -X POST http://localhost:8000/api/workflows/{workspaceId}/pages/{pageId}/test \
  -H 'Content-Type: application/json' --data '{"inputs":{"prompt":"Test task"}}'

# 4. Execute through Microsoft Agent Framework
export OPENAI_API_KEY=...
curl -X POST http://localhost:8000/api/workflows/{workspaceId}/pages/{pageId}/execute \
  -H 'Content-Type: application/json' \
  --data '{"inputs":{"prompt":"Run task"},"approvedEdgeIds":["approval-edge-id"]}'
```

Validation and compilation live in the backend application. Each JSON agent becomes a Microsoft
Agent Framework agent wrapped by `eleven_nodes.MicrosoftAgent`; JSON edges become ElevenNodes
dependencies. The `test` endpoint uses deterministic agents and does not consume model tokens.
Human-approval edges must be listed in `approvedEdgeIds` for real execution.

## Tests

```bash
pytest
```
