import { ROUTES } from '@/constants'
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import { withPageWorkflowIds } from '@/components/agent-workflow/page-workflow-id'
import { toast } from 'sonner'
import { createPage, resolveActiveMainPageId, type Diagram, type DiagramDocument } from '@/components/designer/diagram-types'
import { createDiagramHistoryStack } from '@/components/designer/diagram-history'
import type { PaletteItem } from '@/types/config'
import { enrichDiagram } from '@/components/agent-workflow/agent-workflow-defaults'
import {
  clearExecutionSnapshot,
  createWorkflowWorkspaceHandoff,
  createWorkflowWorkspaceDocument,
  loadWorkflowDocument,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import {
  shouldSyncToolLayout,
  keepToolsWithAgents,
} from '@/components/agent-workflow/tool-agent-mapping'
import { persistWorkflowBuildSpec } from '@/components/agent-workflow/workflow-build-storage'
import { getSession } from '@/services/project-auth-store'
import {
  addSubWorkflowToActiveMain,
  pageIdsRemovedWith,
  stripMountNodesForPages,
} from '@/components/agent-workflow/sub-workflow-ops'

export function useWorkflowDocument(
  paletteById: Map<string, PaletteItem>,
  onInvalidate?: () => void,
) {
  const [doc, setRawDoc] = useState<DiagramDocument>(() => {
    const session = getSession()
    return loadWorkflowDocument(session?.workspaceId)
  })
  // Every change passes through here so new, copied and imported tabs all get their own workflow id.
  const setDoc = useCallback((update: SetStateAction<DiagramDocument>) => {
    setRawDoc((previous) => withPageWorkflowIds(typeof update === 'function' ? update(previous) : update))
  }, [])
  const [workflowName, setWorkflowName] = useState(() => doc.pages[0]?.name ?? 'Untitled workflow')
  const historyRef = useRef(createDiagramHistoryStack())
  const historyPageIdRef = useRef<string | null>(null)
  const docRef = useRef(doc)
  docRef.current = doc

  const activePage = doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0]
  const diagram = useMemo(
    () => enrichDiagram(activePage.diagram, paletteById),
    [activePage.diagram, paletteById],
  )

  useEffect(() => {
    const session = getSession()
    const workspaceId = doc.workspaceId ?? session?.workspaceId
    if (!workspaceId) {
      saveWorkflowDocument(doc)
      return
    }
    saveWorkflowDocument({ ...doc, workspaceId })
  }, [doc])

  useEffect(() => {
    setWorkflowName(activePage.name)
  }, [activePage.id, activePage.name])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void persistWorkflowBuildSpec({
        doc,
        pageId: activePage.id,
        diagram,
        paletteById,
      })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [doc, activePage.id, diagram, paletteById])

  const handleChange = useCallback(
    (updater: (previous: Diagram) => Diagram) => {
      onInvalidate?.()
      setDoc((previous) => {
        if (historyPageIdRef.current !== previous.activePageId) {
          historyRef.current.clear()
          historyPageIdRef.current = previous.activePageId
        }
        return {
          ...previous,
          pages: previous.pages.map((page) => {
            if (page.id !== previous.activePageId) return page
            const before = page.diagram
            const updated = updater(before)
            if (updated === before) return page
            const enriched = enrichDiagram(updated, paletteById)
            const next = shouldSyncToolLayout(before, enriched)
              ? keepToolsWithAgents(before, enriched)
              : enriched
            if (next === before) return page
            historyRef.current.push(before)
            return { ...page, diagram: next }
          }),
        }
      })
    },
    [paletteById, onInvalidate],
  )

  /** Step the active page back (or forward). History is read outside the state updater, which
   *  React may run twice, so one click moves exactly one step. */
  const stepHistory = useCallback(
    (direction: 'undo' | 'redo') => {
      const current = docRef.current
      const page = current.pages.find((candidate) => candidate.id === current.activePageId)
      if (!page) return
      const restored =
        direction === 'undo' ? historyRef.current.undo(page.diagram) : historyRef.current.redo(page.diagram)
      if (!restored) return
      onInvalidate?.()
      const next = {
        ...current,
        pages: current.pages.map((candidate) =>
          candidate.id === current.activePageId ? { ...candidate, diagram: restored } : candidate,
        ),
      }
      docRef.current = next
      setDoc(next)
    },
    [onInvalidate],
  )
  const handleUndo = useCallback(() => stepHistory('undo'), [stepHistory])
  const handleRedo = useCallback(() => stepHistory('redo'), [stepHistory])

  const selectPage = useCallback((pageId: string) => {
    historyRef.current.clear()
    historyPageIdRef.current = pageId
    setDoc((previous) => ({ ...previous, activePageId: pageId }))
  }, [])

  const addMainPage = useCallback(() => {
    onInvalidate?.()
    setDoc((previous) => {
      const mains = previous.pages.filter((page) => page.kind !== 'sub' && !page.parentPageId)
      const page = createPage(`Workflow ${mains.length + 1}`, { kind: 'main' })
      historyRef.current.clear()
      historyPageIdRef.current = page.id
      return { ...previous, pages: [...previous.pages, page], activePageId: page.id }
    })
    toast.success('New main workflow tab created.')
  }, [onInvalidate])

  const addSubPage = useCallback((parentPageId?: string) => {
    onInvalidate?.()
    let error: string | undefined
    let created = false
    setDoc((previous) => {
      const result = addSubWorkflowToActiveMain(previous, undefined, parentPageId)
      if ('error' in result) {
        error = result.error
        return previous
      }
      historyRef.current.clear()
      historyPageIdRef.current = result.pageId
      created = true
      return result.doc
    })
    if (error) toast.error(error)
    else if (created) toast.success('Sub-workflow added to that main workflow.')
  }, [onInvalidate])

  const addPage = addMainPage

  const createNewWorkspace = useCallback(() => {
    const nextDoc = createWorkflowWorkspaceDocument()
    const handoffId = createWorkflowWorkspaceHandoff(nextDoc)
    const url = new URL(ROUTES.agentWorkflow, window.location.origin)
    url.searchParams.set('workspaceDraft', handoffId)
    const opened = window.open(url.toString(), '_blank')

    if (opened) {
      opened.opener = null
      toast.success('New workspace opened in a new tab.')
      return
    }

    onInvalidate?.()
    clearExecutionSnapshot()
    setDoc(nextDoc)
    toast.info('Popup blocked. New workspace opened in this tab instead.')
  }, [onInvalidate])

  const createWorkflowTab = useCallback(() => {
    addMainPage()
  }, [addMainPage])

  const renamePage = useCallback(
    (pageId: string, name: string) => {
      setDoc((previous) => ({
        ...previous,
        pages: previous.pages.map((page) => (page.id === pageId ? { ...page, name } : page)),
      }))
      if (pageId === doc.activePageId) setWorkflowName(name)
    },
    [doc.activePageId],
  )

  const setActiveMainPage = useCallback((pageId: string) => {
    let updated = false
    setDoc((previous) => {
      const activeMainPageId = resolveActiveMainPageId(previous.pages, pageId)
      if (!activeMainPageId || activeMainPageId === previous.activeMainPageId) return previous
      updated = true
      return {
        ...previous,
        activeMainPageId,
      }
    })
    if (updated) toast.success('Active main workflow updated.')
  }, [])

  const deletePage = useCallback((pageId: string) => {
    setDoc((previous) => {
      const removedIds = new Set(pageIdsRemovedWith(previous, pageId))
      if (removedIds.size >= previous.pages.length) return previous
      const pages = previous.pages
        .filter((page) => !removedIds.has(page.id))
        .map((page) => ({
          ...page,
          diagram: stripMountNodesForPages(page.diagram, removedIds),
        }))
      const activeStillExists = pages.some((page) => page.id === previous.activePageId)
      return {
        ...previous,
        pages,
        activePageId: activeStillExists ? previous.activePageId : pages[pages.length - 1].id,
        activeMainPageId: resolveActiveMainPageId(pages, previous.activeMainPageId),
      }
    })
  }, [])

  return {
    doc,
    setDoc,
    activePage,
    diagram,
    workflowName,
    setWorkflowName,
    handleChange,
    handleUndo,
    handleRedo,
    selectPage,
    addPage,
    addMainPage,
    addSubPage,
    createWorkflowTab,
    createNewWorkspace,
    renamePage,
    setActiveMainPage,
    deletePage,
  }
}
