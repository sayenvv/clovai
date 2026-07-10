import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createPage, type Diagram, type DiagramDocument } from '@/components/designer/diagram-types'
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

export function useWorkflowDocument(
  paletteById: Map<string, PaletteItem>,
  onInvalidate?: () => void,
) {
  const [doc, setDoc] = useState<DiagramDocument>(() => {
    const session = getSession()
    return loadWorkflowDocument(session?.workspaceId)
  })
  const [workflowName, setWorkflowName] = useState(() => doc.pages[0]?.name ?? 'Untitled workflow')

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
      setDoc((previous) => ({
        ...previous,
        pages: previous.pages.map((page) => {
          if (page.id !== previous.activePageId) return page
          const before = page.diagram
          const enriched = enrichDiagram(updater(before), paletteById)
          const next = shouldSyncToolLayout(before, enriched)
            ? syncMappedToolLayout(enriched)
            : enriched
          return { ...page, diagram: next }
        }),
      }))
    },
    [paletteById, onInvalidate],
  )

  const selectPage = useCallback((pageId: string) => {
    setDoc((previous) => ({ ...previous, activePageId: pageId }))
  }, [])

  const addPage = useCallback(() => {
    onInvalidate?.()
    setDoc((previous) => {
      const page = createPage(`Workflow ${previous.pages.length + 1}`)
      return { ...previous, pages: [...previous.pages, page], activePageId: page.id }
    })
  }, [onInvalidate])

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
    addPage()
    toast.success('New workflow tab created. Build it here, then attach it with Insert → Workflow.')
  }, [addPage])

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

  const deletePage = useCallback((pageId: string) => {
    setDoc((previous) => {
      if (previous.pages.length <= 1) return previous
      const pages = previous.pages.filter((page) => page.id !== pageId)
      return {
        ...previous,
        pages,
        activePageId:
          previous.activePageId === pageId ? pages[pages.length - 1].id : previous.activePageId,
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
    selectPage,
    addPage,
    createWorkflowTab,
    createNewWorkspace,
    renamePage,
    deletePage,
  }
}
