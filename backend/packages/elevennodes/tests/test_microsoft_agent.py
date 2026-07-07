import unittest
from dataclasses import dataclass
from types import SimpleNamespace

from eleven_nodes import (
    AgentContext,
    AgentResult,
    JsonMicrosoftAgentContextAdapter,
    MicrosoftAgent,
    Orchestrator,
    WorkflowBuilder,
)


@dataclass
class FakeUsage:
    input_token_count: int
    output_token_count: int


class FakeFrameworkAgent:
    def __init__(self, response) -> None:
        self.response = response
        self.calls = []

    async def run(self, messages=None, **kwargs):
        self.calls.append((messages, kwargs))
        return self.response


class MicrosoftAgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_runs_framework_agent_and_normalizes_response(self) -> None:
        framework_message = SimpleNamespace(
            role="assistant",
            author_name="Researcher",
            message_id="msg-1",
            text="The structured answer",
            additional_properties={"safety": "passed"},
        )
        framework_response = SimpleNamespace(
            value={"answer": 42},
            text="The structured answer",
            messages=[framework_message],
            response_id="response-1",
            agent_id="maf-agent-1",
            created_at="2026-07-06T10:00:00Z",
            finish_reason="stop",
            usage_details=FakeUsage(input_token_count=12, output_token_count=4),
            continuation_token=None,
            additional_properties={"trace_id": "trace-1"},
        )
        framework_agent = FakeFrameworkAgent(framework_response)
        agent = MicrosoftAgent(
            "research",
            framework_agent,
            run_options={"client_kwargs": {"timeout": 30}},
        )
        workflow = WorkflowBuilder("maf-workflow").add_agent(agent).build()

        result = await Orchestrator().run(
            workflow,
            inputs={"prompt": "Research clean architecture", "audience": "engineers"},
        )

        agent_result = result.nodes["research"].result
        self.assertIsNotNone(agent_result)
        assert agent_result is not None
        self.assertEqual(agent_result.output, {"answer": 42})
        self.assertEqual(agent_result.metadata["response_id"], "response-1")
        self.assertEqual(agent_result.metadata["usage"]["input_token_count"], 12)
        self.assertEqual(agent_result.messages[0].sender, "Researcher")
        self.assertEqual(agent_result.messages[0].topic, "assistant")

        prompt, options = framework_agent.calls[0]
        self.assertTrue(prompt.startswith("Research clean architecture"))
        self.assertIn('"audience": "engineers"', prompt)
        self.assertEqual(
            options,
            {
                "stream": False,
                "session": None,
                "client_kwargs": {"timeout": 30},
            },
        )

    async def test_passes_session_from_async_resolver(self) -> None:
        session = object()
        seen_contexts: list[AgentContext] = []

        async def resolve(context: AgentContext):
            seen_contexts.append(context)
            return session

        framework_agent = FakeFrameworkAgent(SimpleNamespace(value=None, text="done", messages=[]))
        workflow = (
            WorkflowBuilder("session-workflow")
            .add_agent(
                MicrosoftAgent(
                    "worker",
                    framework_agent,
                    session_resolver=resolve,
                )
            )
            .build()
        )

        result = await Orchestrator().run(workflow, inputs={"prompt": "Continue"})

        self.assertEqual(result.outputs["worker"], "done")
        self.assertEqual(len(seen_contexts), 1)
        self.assertIs(framework_agent.calls[0][1]["session"], session)

    async def test_preserves_dependency_outputs_in_downstream_prompt(self) -> None:
        first = FakeFrameworkAgent(SimpleNamespace(value=None, text="research", messages=[]))
        second = FakeFrameworkAgent(SimpleNamespace(value=None, text="draft", messages=[]))
        workflow = (
            WorkflowBuilder("chain")
            .add_agent(MicrosoftAgent("research", first))
            .add_agent(MicrosoftAgent("write", second), depends_on=["research"])
            .build()
        )

        await Orchestrator().run(workflow, inputs={"prompt": "Create an article"})

        downstream_prompt = second.calls[0][0]
        self.assertIn('"research": "research"', downstream_prompt)

    def test_context_adapter_serializes_non_json_values(self) -> None:
        context = AgentContext.create(
            run_id="run-1",
            workflow_id="workflow-1",
            node_id="node-1",
            inputs={"prompt": {"task": "summarize"}, "tags": {"one", "two"}},
            dependency_results={"prior": AgentResult(output=FakeUsage(2, 3))},
        )

        prompt = JsonMicrosoftAgentContextAdapter().adapt(context)

        self.assertIn('"task": "summarize"', prompt)
        self.assertIn('"input_token_count": 2', prompt)

    def test_rejects_stream_and_session_overrides(self) -> None:
        for option in ("stream", "session"):
            with self.subTest(option=option), self.assertRaises(ValueError):
                MicrosoftAgent(
                    "worker",
                    FakeFrameworkAgent(None),
                    run_options={option: True},
                )


if __name__ == "__main__":
    unittest.main()
