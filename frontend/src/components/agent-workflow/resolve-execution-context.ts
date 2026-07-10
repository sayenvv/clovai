import { enrichDiagram } from '@/components/agent-workflow/agent-workflow-defaults'
import { getExecutablePlan } from '@/components/agent-workflow/build-execution-plan'
import {
  loadExecutionSnapshot,
  loadWorkflowDocument,
  mergeDiagramIntoDocument,
  resolveWorkflowPage,
} from '@/components/agent-workflow/workflow-storage'
import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { ExecutionPlanStep } from '@/types/agent-workflow'
import type { PaletteItem } from '@/types/config'
import { getSession } from '@/services/project-auth-store'

export interface ExecutionContext {
  diagram: Diagram
  pageId: string
  pageName: string
  plan: ExecutionPlanStep[]
}

export interface ExecutionBootstrap {
  doc: DiagramDocument
  pageId: string
  input?: string
}

export interface ExecutionHandoff {
  pageId?: string
  pageName?: string
  diagram?: Diagram
  input?: string
}

/** Hydrate execute-page state from router state + session snapshot + localStorage. */
export function bootstrapExecuteState(handoff: ExecutionHandoff): ExecutionBootstrap {
  const snapshot = loadExecutionSnapshot()
  const fresh = loadWorkflowDocument(getSession()?.workspaceId)

  const incomingDiagram = handoff.diagram ?? snapshot?.diagram
  const incomingPageId = handoff.pageId ?? snapshot?.pageId
  const incomingPageName = handoff.pageName ?? snapshot?.pageName
  const incomingInput = handoff.input ?? snapshot?.input

  if (incomingDiagram && incomingPageId) {
    return {
      doc: mergeDiagramIntoDocument(fresh, incomingPageId, incomingDiagram, incomingPageName),
      pageId: incomingPageId,
      input: incomingInput,
    }
  }

  return {
    doc: fresh,
    pageId: handoff.pageId ?? fresh.activePageId ?? fresh.pages[0]?.id ?? '',
    input: incomingInput,
  }
}

export interface ExecutionContextOptions {
  diagramOverride?: Diagram
  pageName?: string
}

/** Build an execution plan from a diagram snapshot. */
export function resolveExecutionContext(
  pageId: string | undefined,
  paletteById: Map<string, PaletteItem>,
  options?: ExecutionContextOptions,
): ExecutionContext | null {
  const sourceDiagram = options?.diagramOverride
  if (sourceDiagram) {
    const diagram = enrichDiagram(sourceDiagram, paletteById)
    const plan = getExecutablePlan(diagram)
    return {
      diagram,
      pageId: pageId ?? '',
      pageName: options.pageName ?? 'Workflow',
      plan,
    }
  }

  const snapshot = loadExecutionSnapshot()
  if (snapshot?.diagram) {
    const diagram = enrichDiagram(snapshot.diagram, paletteById)
    const plan = getExecutablePlan(diagram)
    return {
      diagram,
      pageId: snapshot.pageId,
      pageName: snapshot.pageName,
      plan,
    }
  }

  const doc = loadWorkflowDocument(getSession()?.workspaceId)
  if (!page) return null

  const diagram = enrichDiagram(page.diagram, paletteById)
  const plan = getExecutablePlan(diagram)
  return { diagram, pageId: page.id, pageName: page.name, plan }
}
