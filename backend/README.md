# ClovAI Backend

FastAPI service for ClovAI configuration, workflow, agent, and execution APIs.

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
{"status":"healthy","service":"clovai-api"}
```

## Tests

```bash
pytest
```
