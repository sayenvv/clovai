import inspect
import unittest

from eleven_nodes import (
    Agent,
    AgentContext,
    AgentResult,
    ContextFactory,
    DependencyContextFactory,
    EventPublisher,
    FunctionAgent,
    InvalidStateTransitionError,
    NodeExecution,
    Orchestrator,
    ResultAdapter,
    StateStore,
    WorkflowBuilder,
    WorkflowRunner,
)


class LifecycleAgent(Agent):
    def __init__(self) -> None:
        super().__init__("lifecycle")
        self.calls: list[str] = []

    async def before_execute(self, context: AgentContext) -> None:
        self.calls.append("before")

    async def execute(self, context: AgentContext) -> str:
        self.calls.append("execute")
        return "complete"

    async def after_execute(self, context: AgentContext, result: object) -> None:
        self.calls.append(f"after:{result}")


class RecordingContextFactory(ContextFactory):
    def __init__(self) -> None:
        self.calls = 0
        self._default = DependencyContextFactory()

    def create(self, workflow, run, node) -> AgentContext:
        self.calls += 1
        return self._default.create(workflow, run, node)


class UppercaseResultAdapter(ResultAdapter):
    def adapt(self, value: object) -> AgentResult:
        return AgentResult(output=str(value).upper())


class AbstractionTests(unittest.IsolatedAsyncioTestCase):
    def test_replaceable_behaviors_are_explicit_abstract_classes(self) -> None:
        for abstraction in (
            Agent,
            ContextFactory,
            EventPublisher,
            ResultAdapter,
            StateStore,
            WorkflowRunner,
        ):
            with self.subTest(abstraction=abstraction.__name__):
                self.assertTrue(inspect.isabstract(abstraction))

    async def test_agent_base_class_runs_shared_lifecycle(self) -> None:
        agent = LifecycleAgent()
        workflow = WorkflowBuilder("lifecycle").add_agent(agent).build()

        result = await Orchestrator().run(workflow)

        self.assertEqual(result.outputs["lifecycle"], "complete")
        self.assertEqual(agent.calls, ["before", "execute", "after:complete"])

    async def test_orchestrator_uses_injected_abstract_implementations(self) -> None:
        context_factory = RecordingContextFactory()
        workflow = (
            WorkflowBuilder("replaceable")
            .add_agent(FunctionAgent("worker", lambda context: "custom result"))
            .build()
        )
        orchestrator = Orchestrator(
            context_factory=context_factory,
            result_adapter=UppercaseResultAdapter(),
        )

        result = await orchestrator.run(workflow)

        self.assertEqual(context_factory.calls, 1)
        self.assertEqual(result.outputs["worker"], "CUSTOM RESULT")

    def test_domain_object_rejects_invalid_state_transition(self) -> None:
        execution = NodeExecution(node_id="worker", agent_id="worker")

        with self.assertRaises(InvalidStateTransitionError):
            execution.complete(AgentResult(output="too early"))


if __name__ == "__main__":
    unittest.main()
