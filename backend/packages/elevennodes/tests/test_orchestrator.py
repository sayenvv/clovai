import asyncio
import unittest

from eleven_nodes import (
    Agent,
    AgentContext,
    AgentResult,
    EventType,
    FailurePolicy,
    InMemoryEventPublisher,
    InMemoryStateStore,
    NodeStatus,
    Orchestrator,
    RunStatus,
    WorkflowBuilder,
)


class ResearchAgent(Agent):
    async def execute(self, context: AgentContext) -> AgentResult:
        return AgentResult(output=f"Research: {context.inputs['topic']}")


class WriterAgent(Agent):
    async def execute(self, context: AgentContext) -> str:
        research = context.dependency_results["research"].output
        return f"Article based on [{research}]"


class OrchestratorTests(unittest.IsolatedAsyncioTestCase):
    async def test_executes_agents_and_passes_dependency_results(self) -> None:
        events = InMemoryEventPublisher()
        workflow = (
            WorkflowBuilder("content-team")
            .add_agent(ResearchAgent("research"))
            .add_agent(WriterAgent("writer"), depends_on=["research"])
            .build()
        )
        orchestrator = Orchestrator(
            state_store=InMemoryStateStore(),
            event_publisher=events,
        )

        result = await orchestrator.run(workflow, inputs={"topic": "clean architecture"})

        self.assertEqual(result.status, RunStatus.COMPLETED)
        self.assertEqual(
            result.outputs["writer"],
            "Article based on [Research: clean architecture]",
        )
        stored = await orchestrator.get_run(result.run_id)
        self.assertIsNotNone(stored)
        self.assertEqual(events.events[0].type, EventType.WORKFLOW_STARTED)
        self.assertEqual(events.events[-1].type, EventType.WORKFLOW_COMPLETED)

    async def test_independent_nodes_execute_concurrently(self) -> None:
        active = 0
        peak = 0

        async def work(context: AgentContext) -> str:
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            return context.node_id

        from eleven_nodes import FunctionAgent

        workflow = (
            WorkflowBuilder("parallel")
            .add_agent(FunctionAgent("one", work))
            .add_agent(FunctionAgent("two", work))
            .build()
        )

        result = await Orchestrator().run(workflow)

        self.assertEqual(result.status, RunStatus.COMPLETED)
        self.assertEqual(peak, 2)

    async def test_failure_skips_dependants(self) -> None:
        async def fail(context: AgentContext) -> None:
            raise ValueError("model unavailable")

        from eleven_nodes import FunctionAgent

        workflow = (
            WorkflowBuilder("failure")
            .add_agent(FunctionAgent("failing", fail))
            .add_agent(FunctionAgent("downstream", lambda context: "no"), depends_on=["failing"])
            .build()
        )

        result = await Orchestrator(failure_policy=FailurePolicy.CONTINUE).run(workflow)

        self.assertEqual(result.status, RunStatus.FAILED)
        self.assertEqual(result.nodes["failing"].status, NodeStatus.FAILED)
        self.assertEqual(result.nodes["downstream"].status, NodeStatus.SKIPPED)
        self.assertIn("ValueError", result.failures["failing"])


if __name__ == "__main__":
    unittest.main()
