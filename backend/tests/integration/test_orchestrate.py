from copy import deepcopy

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.workflows.orchestration.runs import RUN_STORE
from tests.integration.test_workflows import SAMPLE_SPEC, executable_spec

client = TestClient(app)

HEADERS = {
    "X-User-Id": "acct_orch",
    "X-User-Email": "orch@example.com",
    "X-User-Name": "Orch%20Owner",
    "X-Workspace-Name": "Orch%20Workspace",
    "X-Account-Type": "company",
}


@pytest.fixture(autouse=True)
def _clear_orchestration_runs():
    RUN_STORE.clear()
    yield
    RUN_STORE.clear()


def _spec(page_id: str, workflow_id: str, agents: list[dict] | None = None) -> dict:
    payload = deepcopy(SAMPLE_SPEC)
    payload["meta"]["workspaceId"] = "ws_orch"
    payload["meta"]["pageId"] = page_id
    payload["meta"]["pageName"] = page_id
    payload["meta"]["workflowId"] = workflow_id
    payload["meta"]["workflowName"] = page_id
    payload["agents"] = agents or []
    return payload


def test_orchestrate_returns_main_and_nested_tabs(isolated_database):
    main = _spec(
        "page_main",
        "wf_main",
        [
            {
                "id": "mount_1",
                "name": "sub_mount",
                "displayName": "Sub mount",
                "description": "",
                "instructions": "",
                "systemPrompt": "",
                "userPrompt": "",
                "toolIds": [],
                "responseSchema": {"raw": "", "parsed": {}},
                "metadata": {
                    "isSubWorkflow": True,
                    "subWorkflowPageId": "page_sub",
                },
            }
        ],
    )
    sub = _spec("page_sub", "wf_sub")
    other = _spec("page_other", "wf_other")

    for payload in (main, sub, other):
        response = client.put(
            f"/api/workflows/ws_orch/pages/{payload['meta']['pageId']}",
            json=payload,
            headers=HEADERS,
        )
        assert response.status_code == 200

    by_sub = client.get("/api/orchestrate/ws_orch/tabs/page_sub")
    assert by_sub.status_code == 200
    body = by_sub.json()
    assert body["workspaceId"] == "ws_orch"
    assert body["tabId"] == "page_sub"
    assert body["rootTabId"] == "page_main"
    assert body["definition"]["meta"]["pageId"] == "page_main"
    assert [tab["tabId"] for tab in body["tabs"]] == ["page_main", "page_sub"]
    assert body["tabs"][0]["isRoot"] is True
    assert body["tabs"][1]["parentTabId"] == "page_main"

    by_main = client.get("/api/orchestrate/ws_orch/tabs/page_main")
    assert by_main.status_code == 200
    assert by_main.json()["rootTabId"] == "page_main"
    assert [tab["tabId"] for tab in by_main.json()["tabs"]] == ["page_main", "page_sub"]

    by_other = client.get("/api/orchestrate/ws_orch/tabs/page_other")
    assert by_other.status_code == 200
    assert by_other.json()["tabs"][0]["tabId"] == "page_other"


def test_orchestrate_missing_tab_returns_404(isolated_database):
    response = client.get("/api/orchestrate/ws_missing/tabs/page_missing")
    assert response.status_code == 404


def _parse_sse(text: str) -> list[dict]:
    events: list[dict] = []
    for block in text.strip().split("\n\n"):
        data_lines = [
            line[6:]
            for line in block.splitlines()
            if line.startswith("data: ")
        ]
        if data_lines:
            events.append(json.loads("\n".join(data_lines)))
    return events


def test_orchestrate_run_streams_pattern_events(isolated_database):
    spec = deepcopy(executable_spec())
    spec["meta"]["workspaceId"] = "ws_orch"
    spec["meta"]["pageId"] = "page_run"
    spec["edges"][0]["humanApproval"] = False
    spec["meta"]["executionMode"] = "standard"
    saved = client.put("/api/workflows/ws_orch/pages/page_run", json=spec, headers=HEADERS)
    assert saved.status_code == 200

    response = client.post(
        "/api/orchestrate/ws_orch/tabs/page_run/run",
        json={"dryRun": True, "inputs": {"prompt": "Go"}},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    events = _parse_sse(response.text)
    types = [event["type"] for event in events]
    assert "workflow_started" in types
    assert "node_started" in types
    assert "node_completed" in types
    assert types[-1] == "run_finished"
    assert events[-1]["data"]["status"] == "completed"
    assert events[-1]["data"]["pattern"] == "sequential"


def test_orchestrate_run_pauses_for_approval_and_resume(isolated_database):
    spec = deepcopy(executable_spec())
    spec["meta"]["workspaceId"] = "ws_orch"
    spec["meta"]["pageId"] = "page_hitl"
    saved = client.put("/api/workflows/ws_orch/pages/page_hitl", json=spec, headers=HEADERS)
    assert saved.status_code == 200

    first = client.post(
        "/api/orchestrate/ws_orch/tabs/page_hitl/run",
        json={"dryRun": True, "inputs": {"prompt": "Go"}},
    )
    assert first.status_code == 200
    events = _parse_sse(first.text)
    types = [event["type"] for event in events]
    assert "approval_required" in types
    assert events[-1]["type"] == "run_finished"
    assert events[-1]["data"]["status"] == "waiting_approval"
    run_id = events[-1]["runId"]

    pending = client.get("/api/orchestrate/pending", params={"workspaceId": "ws_orch"})
    assert pending.status_code == 200
    body = pending.json()
    assert body["count"] == 1
    assert body["requests"][0]["runId"] == run_id
    assert body["requests"][0]["edgeId"] == "research-to-writer"

    resumed = client.post(
        f"/api/orchestrate/runs/{run_id}/resume",
        json={"approvedEdgeIds": ["research-to-writer"]},
    )
    assert resumed.status_code == 200
    resume_events = _parse_sse(resumed.text)
    assert resume_events[-1]["type"] == "run_finished"
    assert resume_events[-1]["data"]["status"] == "completed"
    assert client.get("/api/orchestrate/pending").json()["count"] == 0


def test_orchestrate_resume_missing_run_returns_404():
    response = client.post("/api/orchestrate/runs/missing-run/resume", json={})
    assert response.status_code == 404
