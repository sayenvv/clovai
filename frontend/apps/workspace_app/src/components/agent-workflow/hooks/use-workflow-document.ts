import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  syncMappedToolLayout,
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
  const [doc, setDoc] = useState<DiagramDocument>(() => {
    const session = getSession()
    return loadWorkflowDocument(session?.workspaceId)
  })
  const [workflowName, setWorkflowName] = useState(() => doc.pages[0]?.name ?? 'Untitled workflow')
  const historyRef = useRef(createDiagramHistoryStack())
  const historyPageIdRef = useRef<string | null>(null)

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
            const enriched = enrichDiagram(updater(before), paletteById)
            const next = shouldSyncToolLayout(before, enriched)
              ? syncMappedToolLayout(enriched)
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

  const handleUndo = useCallback(() => {
    setDoc((previous) => {
      const page = previous.pages.find((candidate) => candidate.id === previous.activePageId)
      if (!page) return previous
      const restored = historyRef.current.undo(page.diagram)
      if (!restored) return previous
      onInvalidate?.()
      return {
        ...previous,
        pages: previous.pages.map((candidate) =>
          candidate.id === previous.activePageId
            ? { ...candidate, diagram: restored }
            : candidate,
        ),
      }
    })
  }, [onInvalidate])

  const handleRedo = useCallback(() => {
    setDoc((previous) => {
      const page = previous.pages.find((candidate) => candidate.id === previous.activePageId)
      if (!page) return previous
      const restored = historyRef.current.redo(page.diagram)
      if (!restored) return previous
      onInvalidate?.()
      return {
        ...previous,
        pages: previous.pages.map((candidate) =>
          candidate.id === previous.activePageId
            ? { ...candidate, diagram: restored }
            : candidate,
        ),
      }
    })
  }, [onInvalidate])

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
    const url = new URL('/tools/agent-workflow', window.location.origin)
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
