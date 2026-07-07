from copy import deepcopy

from eleven_nodes import MicrosoftAgent, MicrosoftModelConfig, MicrosoftWorkflowAgentFactory
from eleven_nodes.infrastructure.microsoft import MicrosoftAgentDefinition

from app.modules.workflows.runtime import MicrosoftWorkflowAgentFactory as AppMicrosoftWorkflowAgentFactory
from app.modules.workflows.schemas import WorkflowBuildSpec
from tests.integration.test_workflows import executable_spec


def test_microsoft_factory_converts_json_agent_and_web_search_tool(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    spec = WorkflowBuildSpec.model_validate(executable_spec())
    factory = AppMicrosoftWorkflowAgentFactory(spec.model_config_data)
    source_agent = spec.agents[0]
    source_tool = spec.tools[0]

    agent = factory.create(source_agent, [source_tool])

    assert isinstance(agent, MicrosoftAgent)
    framework_agent = agent.framework_agent
    assert framework_agent.id == "research"
    assert framework_agent.default_options["instructions"] == "Research the supplied task."
    assert framework_agent.default_options["temperature"] == 0.7
    assert framework_agent.default_options["response_format"]["type"] == "object"
    assert framework_agent.default_options["response_format"]["properties"] == {
        "result": {"type": "string"}
    }
    assert framework_agent.default_options["tools"] == [{"type": "web_search"}]


def test_validation_rejects_tool_owner_mismatch() -> None:
    payload = deepcopy(executable_spec())
    payload["tools"][0]["agentId"] = "writer"
    spec = WorkflowBuildSpec.model_validate(payload)

    from app.modules.workflows.compiler import WorkflowCompiler

    report = WorkflowCompiler().validate(spec)

    assert report.valid is False
    assert any(issue.code == "tool_owner_mismatch" for issue in report.issues)


def test_microsoft_factory_omits_sampling_params_for_gpt5() -> None:
    factory = MicrosoftWorkflowAgentFactory(
        MicrosoftModelConfig(provider="azure-openai", model="gpt-5-mini", temperature=0.7)
    )
    agent = factory.create(
        MicrosoftAgentDefinition(
            id="planner",
            name="planner",
            display_name="Intake Planner",
            instructions="Plan the workflow.",
        )
    )

    options = agent.framework_agent.default_options
    assert "temperature" not in options
    assert options["max_tokens"] == 4096
    assert "max_completion_tokens" not in options
