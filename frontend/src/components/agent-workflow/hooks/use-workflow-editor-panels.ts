import { useCallback, useEffect, useRef, useState } from 'react'
import { useHorizontalResize } from '@/hooks/use-horizontal-resize'
import { useVerticalResize } from '@/hooks/use-vertical-resize'
import {
  EDITOR_BOTTOM_PANEL,
  EDITOR_LEFT_PANEL,
  EDITOR_RIGHT_PANEL,
  persistPanelCollapsed,
  persistPanelSize,
  readStoredCollapsed,
  readStoredSize,
  type PersistedPanelConfig,
} from '@/components/agent-workflow/panel-layout'

function usePersistedHorizontalPanel(config: PersistedPanelConfig, invert: boolean) {
  const { width, setWidth, onResizePointerDown } = useHorizontalResize({
    initialWidth: readStoredSize(config),
    minWidth: config.min,
    maxWidth: config.max ?? 2000,
    invert,
  })
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed(config))
  const sizeRef = useRef(width)
  sizeRef.current = width

  useEffect(() => {
    persistPanelSize(config, width, collapsed)
  }, [config, width, collapsed])

  useEffect(() => {
    persistPanelCollapsed(config, collapsed)
  }, [config, collapsed])

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      if (previous) setWidth(sizeRef.current)
      else sizeRef.current = width
      return !previous
    })
  }, [width, setWidth])

  return { size: width, collapsed, onResizePointerDown, toggle }
}

function usePersistedVerticalPanel(config: PersistedPanelConfig) {
  const { height, setHeight, onResizePointerDown } = useVerticalResize({
    initialHeight: readStoredSize(config),
    minHeight: config.min,
  })
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed(config))
  const sizeRef = useRef(height)
  sizeRef.current = height

  useEffect(() => {
    persistPanelSize(config, height, collapsed)
  }, [config, height, collapsed])

  useEffect(() => {
    persistPanelCollapsed(config, collapsed)
  }, [config, collapsed])

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      if (previous) setHeight(sizeRef.current)
      else sizeRef.current = height
      return !previous
    })
  }, [height, setHeight])

  return { size: height, collapsed, onResizePointerDown, toggle }
}

/** Persisted left / right / bottom panels for the workflow editor. */
export function useWorkflowEditorPanels() {
  const left = usePersistedHorizontalPanel(EDITOR_LEFT_PANEL, false)
  const right = usePersistedHorizontalPanel(EDITOR_RIGHT_PANEL, true)
  const bottom = usePersistedVerticalPanel(EDITOR_BOTTOM_PANEL)
  return { left, right, bottom }
}
