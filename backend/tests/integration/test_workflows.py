from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.modules.workflows.runtime import DryRunAgentFactory, WorkflowRuntimeService

client = TestClient(app)

SAMPLE_SPEC = {
    "meta": {
        "schemaVersion": "3.0",
        "workspaceId": "ws_test",
        "pageId": "page_test",
        "pageName": "Test workflow",
        "workflowId": "wf_test",
        "workflowName": "Test workflow",
        "workflowVersion": 1,
        "workflowType": "sequential",
        "executionMode": "standard",
        "status": "draft",
        "description": "",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "updatedAt": "2026-01-01T00:00:00+00:00",
    },
    "modelConfig": {
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.7,
        "topP": 1,
        "maxTokens": 4096,
        "presencePenalty": 0,
        "frequencyPenalty": 0,
        "seed": None,
        "stream": False,
    },
    "agents": [],
    "tools": [],
    "edges": [],
    "settings": {
        "timeoutSeconds": 120,
        "streamResponse": False,
        "retryPolicy": {"maxRetries": 2, "retryDelaySeconds": 3},
        "logging": {"enabled": True, "level": "info"},
        "metadata": {"subWorkflows": []},
    },
}


def test_save_and_load_workflow_build_spec(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.workflows.DATA_ROOT",
        tmp_path / "workflows",
    )
    monkeypatch.setattr(
        "app.api.routes.workflows.REPO_ROOT",
        tmp_path,
    )

    put = client.put(
        "/api/workflows/ws_test/pages/page_test",
        json=SAMPLE_SPEC,
    )
    assert put.status_code == 200
    body = put.json()
    assert body["workspaceId"] == "ws_test"
    assert body["pageId"] == "page_test"
    assert body["workflowId"] == "wf_test"
    assert Path(body["filePath"]).name == "page_test.json"

    get = client.get("/api/workflows/ws_test/pages/page_test")
    assert get.status_code == 200
    assert get.json()["meta"]["workflowId"] == "wf_test"


def executable_spec() -> dict:
    spec = deepcopy(SAMPLE_SPEC)
    spec["agents"] = [
        {
            "id": "research",
            "name": "researcher",
            "displayName": "Researcher",
            "description": "Researches a topic.",
            "instructions": "Research the supplied task.",
            "systemPrompt": "Research the supplied task.",
            "userPrompt": "Return concise research.",
            "isManager": None,
            "isOrchestrator": None,
            "toolIds": ["web-search"],
            "responseSchema": {
                "raw": '{"result":"string"}',
                "parsed": {"result": "string"},
            },
            "metadata": {"agentType": "llm"},
        },
        {
            "id": "writer",
            "name": "writer",
            "displayName": "Writer",
            "description": "Writes the result.",
            "instructions": "Write from the research result.",
            "systemPrompt": "Write from the research result.",
            "userPrompt": "Return the final response.",
            "isManager": None,
            "isOrchestrator": None,
            "toolIds": [],
            "responseSchema": {"raw": "", "parsed": {}},
            "metadata": {"agentType": "llm"},
        },
    ]
    spec["tools"] = [
        {
            "id": "web-search",
            "agentId": "research",
            "name": "web_search",
            "displayName": "Web search",
            "description": "Searches the web.",
            "toolType": "custom",
            "configuration": {"integrations": ["web_search"]},
            "inputSchema": {"raw": "", "parsed": {}},
            "metadata": {},
        }
    ]
    spec["edges"] = [
        {
            "id": "research-to-writer",
            "fromAgentId": "research",
            "toAgentId": "writer",
            "label": "",
            "humanApproval": True,
            "approvalRole": "reviewer",
            "approvalMessage": "Approve the research.",
        }
    ]
    spec["meta"]["executionMode"] = "human-in-the-loop"
    spec["settings"]["retryPolicy"] = {"maxRetries": 0, "retryDelaySeconds": 0}
    return spec


def save_executable_spec(client: TestClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.api.routes.workflows.DATA_ROOT", tmp_path / "workflows")
    monkeypatch.setattr("app.api.routes.workflows.REPO_ROOT", tmp_path)
    response = client.put(
        "/api/workflows/ws_test/pages/page_test",
        json=executable_spec(),
    )
    assert response.status_code == 200


def test_validate_compiles_json_into_execution_layers(tmp_path, monkeypatch) -> None:
    save_executable_spec(client, tmp_path, monkeypatch)

    response = client.post("/api/workflows/ws_test/pages/page_test/validate")

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["summary"]["executionLayers"] == [["research"], ["writer"]]
    assert body["summary"]["approvalEdgeIds"] == ["research-to-writer"]
    assert any(issue["code"] == "approval_required" for issue in body["issues"])


def test_test_endpoint_executes_dependencies_without_model_calls(tmp_path, monkeypatch) -> None:
    save_executable_spec(client, tmp_path, monkeypatch)

    response = client.post(
        "/api/workflows/ws_test/pages/page_test/test",
        json={"inputs": {"prompt": "Research runtime compilation"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "test"
    assert body["status"] == "completed"
    assert body["outputs"]["research"]["agentId"] == "research"
    writer_dependencies = body["outputs"]["writer"]["dependencyOutputs"]
    assert writer_dependencies["research"]["agentId"] == "research"


def test_execute_requires_human_approval_before_creating_provider(tmp_path, monkeypatch) -> None:
    save_executable_spec(client, tmp_path, monkeypatch)

    response = client.post(
        "/api/workflows/ws_test/pages/page_test/execute",
        json={"inputs": {"prompt": "Run"}},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["requiredEdgeIds"] == ["research-to-writer"]


def test_execute_uses_compiled_workflow_with_injected_agent_factory(tmp_path, monkeypatch) -> None:
    save_executable_spec(client, tmp_path, monkeypatch)
    runtime = WorkflowRuntimeService(
        execution_factory_builder=lambda model_config: DryRunAgentFactory()
    )
    monkeypatch.setattr("app.api.routes.workflows.RUNTIME_SERVICE", runtime)

    response = client.post(
        "/api/workflows/ws_test/pages/page_test/execute",
        json={
            "inputs": {"prompt": "Run"},
            "approvedEdgeIds": ["research-to-writer"],
        },
    )

    assert response.status_code == 200
    assert response.json()["mode"] == "execute"
    assert response.json()["status"] == "completed"


def test_validate_reports_dependency_cycles(tmp_path, monkeypatch) -> None:
    spec = executable_spec()
    spec["edges"].append(
        {
            "id": "writer-to-research",
            "fromAgentId": "writer",
            "toAgentId": "research",
            "label": "",
            "humanApproval": False,
            "approvalRole": "reviewer",
            "approvalMessage": "",
        }
    )
    monkeypatch.setattr("app.api.routes.workflows.DATA_ROOT", tmp_path / "workflows")
    monkeypatch.setattr("app.api.routes.workflows.REPO_ROOT", tmp_path)
    put = client.put("/api/workflows/ws_test/pages/page_test", json=spec)
    assert put.status_code == 200

    response = client.post("/api/workflows/ws_test/pages/page_test/validate")

    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert any(issue["code"] == "invalid_graph" for issue in response.json()["issues"])
