from copy import deepcopy

import pytest

from app.modules.workflows.orchestration import (
    OrchestratePayloadError,
    OrchestrationPatternError,
    OrchestrationWorkflowFactory,
    from_orchestrate_payload,
)
from app.modules.workflows.schemas import WorkflowBuildSpec
from tests.integration.test_workflows import SAMPLE_SPEC


def _agent(
    agent_id: str,
    name: str,
    *,
    is_manager: bool | None = None,
    is_orchestrator: bool | None = None,
    metadata: dict | None = None,
    instructions: str = "Do the work.",
) -> dict:
    return {
        "id": agent_id,
        "name": name,
        "displayName": name.title(),
        "description": "",
        "instructions": instructions,
        "systemPrompt": instructions,
        "userPrompt": "",
        "isManager": is_manager,
        "isOrchestrator": is_orchestrator,
        "toolIds": [],
        "responseSchema": {"raw": "", "parsed": {}},
        "metadata": metadata or {},
    }


def _edge(edge_id: str, source: str, target: str) -> dict:
    return {
        "id": edge_id,
        "fromAgentId": source,
        "toAgentId": target,
        "label": "",
        "humanApproval": False,
        "approvalRole": "reviewer",
        "approvalMessage": "Please review and approve this step to continue.",
    }


def _spec(*, workflow_type: str, agents: list[dict], edges: list[dict], orchestration: dict | None = None) -> dict:
    payload = deepcopy(SAMPLE_SPEC)
    payload["meta"]["workflowType"] = workflow_type
    payload["agents"] = agents
    payload["edges"] = edges
    if orchestration is not None:
        payload["settings"]["orchestration"] = orchestration
    return payload


def parallel_fan_out_spec() -> dict:
    return _spec(
        workflow_type="parallel",
        agents=[
            _agent("dispatcher", "dispatcher", metadata={"agentType": "planner", "paletteId": "aw-planner"}),
            _agent("researcher", "researcher", metadata={"agentType": "specialist", "paletteId": "aw-specialist"}),
            _agent("analyst", "analyst", metadata={"agentType": "llm", "paletteId": "aw-llm-agent"}),
            _agent("writer", "writer", metadata={"agentType": "llm", "paletteId": "aw-agent"}),
        ],
        edges=[
            _edge("d-r", "dispatcher", "researcher"),
            _edge("d-a", "dispatcher", "analyst"),
            _edge("r-w", "researcher", "writer"),
            _edge("a-w", "analyst", "writer"),
        ],
    )


def sequential_chain_spec() -> dict:
    return _spec(
        workflow_type="sequential",
        agents=[
            _agent("research", "researcher"),
            _agent("writer", "writer"),
        ],
        edges=[_edge("research-to-writer", "research", "writer")],
    )


def test_parallel_fan_out_uses_concurrent_middle_layer() -> None:
    spec = WorkflowBuildSpec.model_validate(parallel_fan_out_spec())
    built = OrchestrationWorkflowFactory().from_spec(spec)

    assert built.pattern == "parallel"
    assert built.start_agent_id == "dispatcher"
    assert built.execution_layers == (
        ("dispatcher",),
        ("analyst", "researcher"),
        ("writer",),
    )
    assert built.workflow.nodes["researcher"].dependencies == frozenset({"dispatcher"})
    assert built.workflow.nodes["writer"].dependencies == frozenset({"analyst", "researcher"})


def test_sequential_chain_is_a_single_path() -> None:
    spec = WorkflowBuildSpec.model_validate(sequential_chain_spec())
    built = OrchestrationWorkflowFactory().from_spec(spec)

    assert built.pattern == "sequential"
    assert built.start_agent_id == "research"
    assert built.execution_layers == (("research",), ("writer",))
    assert built.workflow.nodes["writer"].dependencies == frozenset({"research"})


def test_from_orchestrate_payload_uses_definition_and_skips_duplicate_root_tab() -> None:
    definition = parallel_fan_out_spec()
    nested = sequential_chain_spec()
    nested["meta"]["pageId"] = "page_sub"
    nested["meta"]["workflowId"] = "wf_sub"

    payload = {
        "workspaceId": "ws_test",
        "tabId": "page_test",
        "rootTabId": "page_test",
        "definition": definition,
        "tabs": [
            {"tabId": "page_test", "parentTabId": None, "isRoot": True, "definition": definition},
            {"tabId": "page_sub", "parentTabId": "page_test", "isRoot": False, "definition": nested},
        ],
    }

    document = from_orchestrate_payload(payload)
    assert document.spec.meta.page_id == "page_test"
    assert list(document.nested) == ["page_sub"]

    built = OrchestrationWorkflowFactory().from_orchestrate_payload(payload)
    assert built.pattern == "parallel"
    assert "page_sub" in built.nested
    assert built.nested["page_sub"].meta.workflow_type == "sequential"


def test_from_orchestrate_payload_requires_definition() -> None:
    with pytest.raises(OrchestratePayloadError):
        from_orchestrate_payload({"tabs": []})


def test_groupchat_requires_a_manager() -> None:
    payload = _spec(
        workflow_type="groupchat",
        agents=[_agent("a", "alpha"), _agent("b", "beta")],
        edges=[],
    )
    spec = WorkflowBuildSpec.model_validate(payload)
    with pytest.raises(OrchestrationPatternError, match="manager"):
        OrchestrationWorkflowFactory().from_spec(spec)


def test_groupchat_accepts_manager_flag() -> None:
    payload = _spec(
        workflow_type="groupchat",
        agents=[
            _agent("lead", "lead", is_manager=True),
            _agent("specialist", "specialist"),
        ],
        edges=[],
    )
    built = OrchestrationWorkflowFactory().from_spec(WorkflowBuildSpec.model_validate(payload))
    assert built.pattern == "groupchat"
    assert built.manager_agent_id == "lead"


def test_magnetic_requires_a_manager() -> None:
    payload = _spec(
        workflow_type="magnetic",
        agents=[_agent("a", "alpha"), _agent("b", "beta")],
        edges=[],
    )
    spec = WorkflowBuildSpec.model_validate(payload)
    with pytest.raises(OrchestrationPatternError, match="manager"):
        OrchestrationWorkflowFactory().from_spec(spec)


def test_magnetic_uses_single_planner_palette() -> None:
    payload = _spec(
        workflow_type="magnetic",
        agents=[
            _agent("planner", "planner", metadata={"agentType": "planner", "paletteId": "aw-planner"}),
            _agent("specialist", "specialist", metadata={"agentType": "specialist"}),
        ],
        edges=[_edge("p-s", "planner", "specialist")],
    )
    built = OrchestrationWorkflowFactory().from_spec(WorkflowBuildSpec.model_validate(payload))
    assert built.pattern == "magnetic"
    assert built.manager_agent_id == "planner"


def test_handoff_requires_unique_start() -> None:
    payload = _spec(
        workflow_type="handoff",
        agents=[_agent("a", "alpha"), _agent("b", "beta")],
        edges=[],
    )
    spec = WorkflowBuildSpec.model_validate(payload)
    with pytest.raises(OrchestrationPatternError, match="start"):
        OrchestrationWorkflowFactory().from_spec(spec)


def test_handoff_uses_configured_start() -> None:
    payload = _spec(
        workflow_type="handoff",
        agents=[_agent("a", "alpha"), _agent("b", "beta")],
        edges=[_edge("a-b", "a", "b")],
        orchestration={"startAgentId": "a", "maxRounds": 4},
    )
    built = OrchestrationWorkflowFactory().from_spec(WorkflowBuildSpec.model_validate(payload))
    assert built.pattern == "handoff"
    assert built.start_agent_id == "a"


def test_existing_json_without_orchestration_block_still_validates() -> None:
    spec = WorkflowBuildSpec.model_validate(sequential_chain_spec())
    assert spec.settings.orchestration is None
