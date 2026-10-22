import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface UseHorizontalResizeOptions {
  initialWidth: number
  minWidth: number
  maxWidth: number
  /** When true, dragging left increases width (right-docked panels). */
  invert?: boolean
}

/** Pointer-driven horizontal resize for side panels. */
export function useHorizontalResize({
  initialWidth,
  minWidth,
  maxWidth,
  invert = false,
}: UseHorizontalResizeOptions) {
  const [width, setWidth] = useState(initialWidth)
  const widthRef = useRef(width)
  widthRef.current = width

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = widthRef.current

      const onMove = (moveEvent: PointerEvent) => {
        const delta = invert ? startX - moveEvent.clientX : moveEvent.clientX - startX
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
        setWidth(next)
      }

      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [invert, maxWidth, minWidth],
  )

  return { width, setWidth, onResizePointerDown }
}
