/** Canvas selection — single node, multi-node, or edge. */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'nodes'; ids: string[] }
  | { kind: 'edge'; id: string }
  | null

export function selectedNodeIds(selection: Selection): string[] {
  if (!selection) return []
  if (selection.kind === 'node') return [selection.id]
  if (selection.kind === 'nodes') return selection.ids
  return []
}

export function isNodeInSelection(selection: Selection, nodeId: string): boolean {
  return selectedNodeIds(selection).includes(nodeId)
}

export function selectionNodeCount(selection: Selection): number {
  return selectedNodeIds(selection).length
}

export function toggleNodeInSelection(selection: Selection, nodeId: string): Selection {
  const current = selectedNodeIds(selection)
  if (current.includes(nodeId)) {
    const next = current.filter((id) => id !== nodeId)
    if (next.length === 0) return null
    if (next.length === 1) return { kind: 'node', id: next[0] }
    return { kind: 'nodes', ids: next }
  }
  if (current.length === 0) return { kind: 'node', id: nodeId }
  return { kind: 'nodes', ids: [...current, nodeId] }
}

export function mergeNodeIntoSelection(selection: Selection, nodeId: string): Selection {
  const current = selectedNodeIds(selection)
  if (current.includes(nodeId)) return selection
  if (current.length === 0) return { kind: 'node', id: nodeId }
  return { kind: 'nodes', ids: [...current, nodeId] }
}
