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

/** A side panel whose width and collapsed state are kept in this browser. */
export function usePersistedHorizontalPanel(config: PersistedPanelConfig, invert: boolean) {
  const maxWidth = config.max ?? 2000
  const { width, setWidth, onResizePointerDown } = useHorizontalResize({
    initialWidth: readStoredSize(config),
    minWidth: config.min,
    maxWidth,
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

  useEffect(() => {
    const handleResize = () => {
      setWidth((previous) => Math.min(maxWidth, Math.max(config.min, previous)))
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [config.min, maxWidth, setWidth])

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      if (previous) setWidth(sizeRef.current)
      else sizeRef.current = width
      return !previous
    })
  }, [width, setWidth])

  const expand = useCallback(() => {
    setCollapsed((previous) => {
      if (!previous) return previous
      setWidth(sizeRef.current)
      return false
    })
  }, [setWidth])

  const collapse = useCallback(() => {
    setCollapsed((previous) => {
      if (previous) return previous
      sizeRef.current = width
      return true
    })
  }, [width])

  /** Resize by `delta` pixels, for the keyboard. */
  const nudge = useCallback(
    (delta: number) => setWidth((previous) => Math.min(maxWidth, Math.max(config.min, previous + delta))),
    [config.min, maxWidth, setWidth],
  )

  return { size: width, collapsed, onResizePointerDown, toggle, expand, collapse, nudge }
}

function usePersistedVerticalPanel(config: PersistedPanelConfig) {
  const { height, setHeight, onResizePointerDown } = useVerticalResize({
    initialHeight: readStoredSize(config),
    minHeight: config.min,
    maxHeight: config.max,
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

  const expand = useCallback(() => {
    setCollapsed((previous) => {
      if (!previous) return previous
      setHeight(sizeRef.current)
      return false
    })
  }, [setHeight])

  const collapse = useCallback(() => {
    setCollapsed((previous) => {
      if (previous) return previous
      sizeRef.current = height
      return true
    })
  }, [height])

  return { size: height, collapsed, onResizePointerDown, toggle, expand, collapse }
}

/** Persisted left / right / bottom panels for the workflow editor. */
export function useWorkflowEditorPanels() {
  const left = usePersistedHorizontalPanel(EDITOR_LEFT_PANEL, false)
  const right = usePersistedHorizontalPanel(EDITOR_RIGHT_PANEL, true)
  const bottom = usePersistedVerticalPanel(EDITOR_BOTTOM_PANEL)
  return { left, right, bottom }
}
