import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowBuildSaveResult, WorkflowBuildSpec, WorkflowModelConfig } from '@/types/workflow-build-spec'
import { buildWorkflowSpec } from '@/components/agent-workflow/build-workflow-spec'
import { saveWorkflowBuildSpecToApi } from '@/services/workflow-build-api'
import { createWorkflowId } from '@/components/agent-workflow/agent-workflow-defaults'

const WORKSPACE_ID_KEY = 'clovai-workspace-id'
const BUILD_INDEX_KEY = 'clovai-workflow-build-index'

export function buildSpecStorageKey(workspaceId: string, pageId: string): string {
  return `clovai-workflow-build:${workspaceId}:${pageId}`
}

/** Stable workspace id for namespacing build artifacts on this browser. */
export function getOrCreateWorkspaceId(): string {
  try {
    const existing = localStorage.getItem(WORKSPACE_ID_KEY)
    if (existing) return existing
    const created = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(WORKSPACE_ID_KEY, created)
    return created
  } catch {
    return `ws_local_${createWorkflowId()}`
  }
}

export function ensureDocumentWorkspaceId(doc: DiagramDocument): DiagramDocument {
  if (doc.workspaceId) return doc
  return { ...doc, workspaceId: getOrCreateWorkspaceId() }
}

function updateBuildIndex(entry: WorkflowBuildSaveResult): void {
  try {
    const raw = localStorage.getItem(BUILD_INDEX_KEY)
    const index: WorkflowBuildSaveResult[] = raw ? JSON.parse(raw) : []
    const next = [
      entry,
      ...index.filter(
        (item) =>
          !(item.workspaceId === entry.workspaceId && item.pageId === entry.pageId),
      ),
    ].slice(0, 50)
    localStorage.setItem(BUILD_INDEX_KEY, JSON.stringify(next))
  } catch {
    // quota / private mode
  }
}

export function loadWorkflowBuildSpec(
  workspaceId: string,
  pageId: string,
): WorkflowBuildSpec | null {
  try {
    const raw = localStorage.getItem(buildSpecStorageKey(workspaceId, pageId))
    if (!raw) return null
    return JSON.parse(raw) as WorkflowBuildSpec
  } catch {
    return null
  }
}

export function listWorkflowBuildIndex(): WorkflowBuildSaveResult[] {
  try {
    const raw = localStorage.getItem(BUILD_INDEX_KEY)
    return raw ? (JSON.parse(raw) as WorkflowBuildSaveResult[]) : []
  } catch {
    return []
  }
}

interface PersistWorkflowBuildOptions {
  doc: DiagramDocument
  pageId: string
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  syncToDisk?: boolean
  requireApi?: boolean
  serverModelConfig?: WorkflowModelConfig
}

/** Build spec from the canvas and persist to localStorage. API sync only when `syncToDisk` is true (explicit Save). */
export async function persistWorkflowBuildSpec({
  doc,
  pageId,
  diagram,
  paletteById,
  syncToDisk = false,
  requireApi = false,
  serverModelConfig,
}: PersistWorkflowBuildOptions): Promise<WorkflowBuildSaveResult> {
  const withWorkspace = ensureDocumentWorkspaceId(doc)
  const workspaceId = withWorkspace.workspaceId!
  const workflowId = withWorkspace.workflow?.workflowId ?? `wf_${pageId}`

  const spec = buildWorkflowSpec({
    doc: withWorkspace,
    pageId,
    diagram,
    paletteById,
    workspaceId,
    serverModelConfig,
  })

  const localStorageKey = buildSpecStorageKey(workspaceId, pageId)
  const savedAt = spec.meta.updatedAt

  try {
    localStorage.setItem(localStorageKey, JSON.stringify(spec, null, 2))
  } catch {
    // quota
  }

  const result: WorkflowBuildSaveResult = {
    workspaceId,
    pageId,
    workflowId,
    localStorageKey,
    savedAt,
  }

  if (syncToDisk) {
    try {
      const apiResult = await saveWorkflowBuildSpecToApi(spec)
      result.filePath = apiResult.filePath
    } catch (error) {
      if (requireApi) throw error
      // Backend may be offline in local dev — localStorage still holds the spec.
    }
  }

  updateBuildIndex(result)
  return result
}
