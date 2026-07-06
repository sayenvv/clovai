import { useCallback, useMemo, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import type { Diagram, DiagramDocument, Viewport } from '@/components/designer/diagram-types'
import type { Selection } from '@/components/designer/selection-utils'
import { selectedNodeIds } from '@/components/designer/selection-utils'
import {
  convertAgentsToSubWorkflow,
  diagramContentCenter,
  insertDiagramAt,
  isSubWorkflowNode,
  mergeImportedDocument,
  mountPageAsSubWorkflow,
  offsetToPlaceDiagram,
} from '@/components/agent-workflow/sub-workflow-ops'
import { isAgentNode } from '@/components/agent-workflow/tool-agent-mapping'
import type { InsertDialogTab, InsertWorkflowMode } from '@/components/agent-workflow/InsertWorkflowDialog'

interface UseSubWorkflowActionsOptions {
  doc: DiagramDocument
  diagram: Diagram
  selection: Selection
  setDoc: (doc: DiagramDocument) => void
  setSelection: (selection: Selection) => void
  setIsValidated: (value: boolean) => void
  handleChange: (updater: (previous: Diagram) => Diagram) => void
  getCanvasInsertAnchor: () => { x: number; y: number }
}

export function useSubWorkflowActions({
  doc,
  diagram,
  selection,
  setDoc,
  setSelection,
  setIsValidated,
  handleChange,
  getCanvasInsertAnchor,
}: UseSubWorkflowActionsOptions) {
  const [convertOpen, setConvertOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [insertTab, setInsertTab] = useState<InsertDialogTab>('workflow')

  const selectedAgentIds = useMemo(
    () =>
      selectedNodeIds(selection).filter((id) => {
        const node = diagram.nodes.find((candidate) => candidate.id === id)
        return node && isAgentNode(node) && !isSubWorkflowNode(node)
      }),
    [selection, diagram.nodes],
  )

  const canConvert = selectedAgentIds.length >= 2

  const convertDefaultName = useMemo(() => {
    if (selectedAgentIds.length === 0) return `Sub-workflow ${doc.pages.length + 1}`
    const labels = selectedAgentIds
      .map((id) => diagram.nodes.find((node) => node.id === id)?.label)
      .filter(Boolean)
      .slice(0, 2)
    return labels.length > 0 ? labels.join(' + ') : `Sub-workflow ${doc.pages.length + 1}`
  }, [selectedAgentIds, diagram.nodes, doc.pages.length])

  const openInsert = useCallback((tab: InsertDialogTab) => {
    setInsertTab(tab)
    setInsertOpen(true)
  }, [])

  const insertFromPage = useCallback(
    (pageId: string, mode: InsertWorkflowMode) => {
      const sourcePage = doc.pages.find((page) => page.id === pageId)
      if (!sourcePage) {
        toast.error('Workflow page not found.')
        return
      }
      const anchor = getCanvasInsertAnchor()
      if (mode === 'mount') {
        const result = mountPageAsSubWorkflow(doc, doc.activePageId, pageId, anchor)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setIsValidated(false)
        setDoc(result.doc)
        setSelection({ kind: 'node', id: result.subWorkflowNodeId })
        toast.success(`Mounted "${sourcePage.name}" as a sub-workflow agent.`)
        return
      }
      const offset = offsetToPlaceDiagram(diagram, sourcePage.diagram, anchor)
      handleChange((previous) => insertDiagramAt(previous, sourcePage.diagram, offset))
      toast.success(`Inserted nodes from "${sourcePage.name}".`)
    },
    [doc, diagram, getCanvasInsertAnchor, handleChange, setDoc, setIsValidated, setSelection],
  )

  const importDocument = useCallback(
    (imported: DiagramDocument, mode: InsertWorkflowMode) => {
      if (imported.pages.length === 0) {
        toast.error('No workflow pages found in the file.')
        return
      }
      const anchor = getCanvasInsertAnchor()
      if (mode === 'mount') {
        const merged = mergeImportedDocument(doc, imported)
        if (!merged.firstPageId) {
          toast.error('Could not import workflow.')
          return
        }
        const result = mountPageAsSubWorkflow(merged.doc, doc.activePageId, merged.firstPageId, anchor)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setIsValidated(false)
        setDoc(result.doc)
        setSelection({ kind: 'node', id: result.subWorkflowNodeId })
        toast.success('Imported and mounted workflow as a sub-workflow agent.')
        return
      }
      const sourcePage =
        imported.pages.find((page) => page.id === imported.activePageId) ?? imported.pages[0]
      const offset = offsetToPlaceDiagram(diagram, sourcePage.diagram, anchor)
      handleChange((previous) => insertDiagramAt(previous, sourcePage.diagram, offset))
      toast.success(`Inserted nodes from "${sourcePage.name}".`)
    },
    [doc, diagram, getCanvasInsertAnchor, handleChange, setDoc, setIsValidated, setSelection],
  )

  const mountWorkflow = useCallback(
    (pageId: string) => insertFromPage(pageId, 'mount'),
    [insertFromPage],
  )

  const requestConvert = useCallback(() => {
    if (!canConvert) {
      toast.error('Select at least two agents to convert.')
      return
    }
    setConvertOpen(true)
  }, [canConvert])

  const confirmConvert = useCallback(
    (name: string) => {
      const result = convertAgentsToSubWorkflow(doc, doc.activePageId, selectedAgentIds, name)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setIsValidated(false)
      setDoc(result.doc)
      setSelection({ kind: 'node', id: result.subWorkflowNodeId })
      toast.success('Converted selection into a sub-workflow agent.')
    },
    [doc, selectedAgentIds, setDoc, setIsValidated, setSelection],
  )

  return {
    convertOpen,
    setConvertOpen,
    insertOpen,
    setInsertOpen,
    insertTab,
    openInsert,
    canConvert,
    convertDefaultName,
    selectedAgentCount: selectedAgentIds.length,
    requestConvert,
    confirmConvert,
    insertFromPage,
    importDocument,
    mountWorkflow,
  }
}

export function canvasInsertAnchor(
  diagram: Diagram,
  canvasRef: RefObject<HTMLDivElement | null>,
  viewport: Viewport,
): { x: number; y: number } {
  const rect = canvasRef.current?.getBoundingClientRect()
  if (!rect?.width || !rect?.height) return diagramContentCenter(diagram)
  return {
    x: (rect.width / 2 - viewport.x) / viewport.scale,
    y: (rect.height / 2 - viewport.y) / viewport.scale,
  }
}
