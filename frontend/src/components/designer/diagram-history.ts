import { useCallback, useRef, useState } from 'react'
import type { Diagram } from './diagram-types'

const MAX_HISTORY = 80

/** Lightweight undo/redo stack for page-level diagram mutations. */
export function createDiagramHistoryStack(max = MAX_HISTORY) {
  let past: Diagram[] = []
  let future: Diagram[] = []

  return {
    push(previous: Diagram) {
      past = [...past.slice(-(max - 1)), previous]
      future = []
    },
    clear() {
      past = []
      future = []
    },
    undo(current: Diagram): Diagram | null {
      if (past.length === 0) return null
      const previous = past[past.length - 1]
      past = past.slice(0, -1)
      future = [current, ...future].slice(0, max)
      return previous
    },
    redo(current: Diagram): Diagram | null {
      if (future.length === 0) return null
      const next = future[0]
      future = future.slice(1)
      past = [...past, current].slice(-max)
      return next
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  }
}

/**
 * Undo/redo stack for diagram mutations.
 * Call `pushHistory` before applying a change (or use `commit` to push + apply).
 */
export function useDiagramHistory(initial: Diagram) {
  const [diagram, setDiagram] = useState(initial)
  const pastRef = useRef<Diagram[]>([])
  const futureRef = useRef<Diagram[]>([])
  const diagramRef = useRef(diagram)
  diagramRef.current = diagram

  const commit = useCallback((updater: (previous: Diagram) => Diagram) => {
    setDiagram((previous) => {
      const next = updater(previous)
      if (next === previous) return previous
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), previous]
      futureRef.current = []
      return next
    })
  }, [])

  const replace = useCallback((next: Diagram) => {
    setDiagram((previous) => {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), previous]
      futureRef.current = []
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setDiagram((current) => {
      const past = pastRef.current
      if (past.length === 0) return current
      const previous = past[past.length - 1]
      pastRef.current = past.slice(0, -1)
      futureRef.current = [current, ...futureRef.current].slice(0, MAX_HISTORY)
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    setDiagram((current) => {
      const future = futureRef.current
      if (future.length === 0) return current
      const next = future[0]
      futureRef.current = future.slice(1)
      pastRef.current = [...pastRef.current, current].slice(-MAX_HISTORY)
      return next
    })
  }, [])

  const canUndo = () => pastRef.current.length > 0
  const canRedo = () => futureRef.current.length > 0

  return {
    diagram,
    setDiagram,
    commit,
    replace,
    undo,
    redo,
    canUndo,
    canRedo,
    diagramRef,
  }
}
