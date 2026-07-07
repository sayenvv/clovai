from app.modules.workflows.workflow_generator import (
    GenerateWorkflowRequest,
    WorkflowGenerationPlan,
    _normalize_plan_dict,
    _parse_plan_json,
    _template_plan,
    generate_workflow_plan,
)


def test_template_plan_has_agents_and_edge():
    result = generate_workflow_plan(
        GenerateWorkflowRequest(
            prompt="Build a workflow that researches competitors and writes a summary report.",
            workflow_name="Competitor research",
        ),
    )

    assert result.origin == "template"
    assert result.plan.workflow_name == "Competitor research"
    assert len(result.plan.agents) >= 2
    assert len(result.plan.edges) >= 1


def test_parse_plan_json_normalizes_keys():
    raw = """
    {
      "workflow_name": "Support triage",
      "description": "Route tickets",
      "execution_type": "sequential",
      "agents": [
        {
          "name": "Triage",
          "description": "Classify tickets",
          "instructions": "## Triage\\n\\n### Role\\nClassify"
        },
        {
          "key": "responder",
          "name": "Responder",
          "description": "Draft replies",
          "palette_id": "aw-agent",
          "instructions": "## Responder"
        }
      ],
      "edges": [
        { "from": "triage", "to": "responder", "human_approval": false }
      ]
    }
    """

    plan = _parse_plan_json(raw)
    assert plan is not None
    assert plan.workflow_name == "Support triage"
    assert {agent.key for agent in plan.agents} >= {"triage", "responder"}
    assert plan.edges[0].from_key in {agent.key for agent in plan.agents}


def test_normalize_plan_rejects_invalid_palette():
    normalized = _normalize_plan_dict(
        {
            "workflow_name": "Test",
            "agents": [{"key": "a1", "name": "Agent", "palette_id": "invalid"}],
            "edges": [],
        }
    )
    plan = WorkflowGenerationPlan.model_validate(normalized)
    assert plan.agents[0].palette_id == "aw-agent"
