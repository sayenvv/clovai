# Eleven Nodes Backend

FastAPI service for Eleven Nodes configuration, workflow, agent, and execution APIs.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env
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

## Workflow runtime

The workflow API uses the saved JSON definition as its source of truth:

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
