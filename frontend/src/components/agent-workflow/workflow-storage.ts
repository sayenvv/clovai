import { STORAGE_KEYS } from '@/constants'
import {
  createPage,
  normalizeDocument,
  type Diagram,
  type DiagramDocument,
} from '@/components/designer/diagram-types'
import type { AgentWorkflowMeta } from '@/types/agent-workflow'
import { createWorkflowId } from '@/components/agent-workflow/agent-workflow-defaults'
import { getOrCreateWorkspaceId } from '@/components/agent-workflow/workflow-build-storage'
import { resolveWorkflowModelConfig } from '@/components/agent-workflow/workflow-model-config'

export const AGENT_WORKFLOW_TOOL_ID = 'agent-workflow'

const EXECUTION_SNAPSHOT_KEY = 'eleven-nodes-agent-workflow-execution-snapshot'

export interface ExecutionSnapshot {
  pageId: string
  pageName: string
  diagram: Diagram
  input?: string
  savedAt: number
}

function defaultWorkflowMeta(): AgentWorkflowMeta {
  return {
    workflowId: createWorkflowId(),
    version: 1,
    status: 'draft',
    executionType: 'sequential',
    modelConfig: resolveWorkflowModelConfig(),
  }
}

export function loadWorkflowDocument(): DiagramDocument {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.diagram(AGENT_WORKFLOW_TOOL_ID))
    if (raw) {
      const doc = normalizeDocument(JSON.parse(raw))
      const workflow = doc.workflow ?? defaultWorkflowMeta()
      return {
        ...doc,
        workspaceId: doc.workspaceId ?? getOrCreateWorkspaceId(),
        workflow: {
          ...workflow,
          modelConfig: resolveWorkflowModelConfig(workflow.modelConfig),
        },
      }
    }
  } catch {
    // corrupted draft
  }
  const page = createPage('Main workflow')
  return {
    pages: [page],
    activePageId: page.id,
    workspaceId: getOrCreateWorkspaceId(),
    workflow: defaultWorkflowMeta(),
  }
}

export function saveWorkflowDocument(doc: DiagramDocument): void {
  try {
    localStorage.setItem(STORAGE_KEYS.diagram(AGENT_WORKFLOW_TOOL_ID), JSON.stringify(doc))
  } catch {
    // quota / private mode
  }
}

export function resolveWorkflowPage(doc: DiagramDocument, pageId?: string) {
  if (pageId) {
    const match = doc.pages.find((page) => page.id === pageId)
    if (match) return match
  }
  return doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0] ?? null
}

/** Persist a diagram snapshot for the execute page (survives router state quirks). */
export function saveExecutionSnapshot(
  snapshot: Omit<ExecutionSnapshot, 'savedAt'>,
): void {
  try {
    const payload: ExecutionSnapshot = { ...snapshot, savedAt: Date.now() }
    sessionStorage.setItem(EXECUTION_SNAPSHOT_KEY, JSON.stringify(payload))
  } catch {
    // private mode / quota
  }
}

export function loadExecutionSnapshot(): ExecutionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(EXECUTION_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExecutionSnapshot
    if (!parsed?.diagram || !parsed.pageId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearExecutionSnapshot(): void {
  try {
    sessionStorage.removeItem(EXECUTION_SNAPSHOT_KEY)
  } catch {
    // ignore
  }
}

/** Merge an incoming diagram snapshot into a workflow document. */
export function mergeDiagramIntoDocument(
  doc: DiagramDocument,
  pageId: string,
  diagram: Diagram,
  pageName?: string,
): DiagramDocument {
  const hasPage = doc.pages.some((page) => page.id === pageId)
  const pages = hasPage
    ? doc.pages.map((page) => (page.id === pageId ? { ...page, diagram } : page))
    : [...doc.pages, { id: pageId, name: pageName ?? 'Workflow', diagram }]
  return { ...doc, pages, activePageId: pageId }
}
