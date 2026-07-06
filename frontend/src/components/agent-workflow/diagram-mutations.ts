import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig } from '@/types/agent-workflow'

type NodePatch = Partial<DiagramNode> | { agent: Partial<AgentNodeConfig> }

function applyNodePatch(node: DiagramNode, patch: NodePatch): DiagramNode {
  if ('agent' in patch && patch.agent) {
    return { ...node, agent: { ...node.agent!, ...patch.agent } as AgentNodeConfig }
  }
  return { ...node, ...(patch as Partial<DiagramNode>) }
}

/** Immutable node patch on the active diagram. */
export function patchDiagramNode(diagram: Diagram, nodeId: string, patch: NodePatch): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) =>
      node.id === nodeId ? applyNodePatch(node, patch) : node,
    ),
  }
}
