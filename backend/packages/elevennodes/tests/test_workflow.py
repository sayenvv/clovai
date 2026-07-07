import unittest

from eleven_nodes import FunctionAgent, InvalidWorkflowError, WorkflowBuilder


class WorkflowTests(unittest.TestCase):
    def test_builds_topological_layers(self) -> None:
        def noop(context):
            return None

        workflow = (
            WorkflowBuilder("research-pipeline")
            .add_agent(FunctionAgent("researcher", noop))
            .add_agent(FunctionAgent("critic", noop), depends_on=["researcher"])
            .add_agent(FunctionAgent("writer", noop), depends_on=["researcher"])
            .add_agent(FunctionAgent("editor", noop), depends_on=["critic", "writer"])
            .build()
        )

        self.assertEqual(
            workflow.layers(),
            (("researcher",), ("critic", "writer"), ("editor",)),
        )

    def test_rejects_dependency_cycle(self) -> None:
        def noop(context):
            return None

        builder = WorkflowBuilder("cycle")
        builder.add_agent(FunctionAgent("one", noop), depends_on=["two"])
        builder.add_agent(FunctionAgent("two", noop), depends_on=["one"])

        with self.assertRaises(InvalidWorkflowError):
            builder.build()


if __name__ == "__main__":
    unittest.main()
