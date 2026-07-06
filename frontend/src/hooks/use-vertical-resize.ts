import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface UseVerticalResizeOptions {
  initialHeight: number
  minHeight: number
  /** Max height cap; defaults to 60% of viewport at drag time if omitted. */
  maxHeight?: number
}

/** Pointer-driven vertical resize for bottom panels (drag up to expand). */
export function useVerticalResize({
  initialHeight,
  minHeight,
  maxHeight,
}: UseVerticalResizeOptions) {
  const [height, setHeight] = useState(initialHeight)
  const heightRef = useRef(height)
  heightRef.current = height

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startY = event.clientY
      const startHeight = heightRef.current
      const cap = maxHeight ?? window.innerHeight * 0.6

      const onMove = (moveEvent: PointerEvent) => {
        const delta = startY - moveEvent.clientY
        const next = Math.min(cap, Math.max(minHeight, startHeight + delta))
        setHeight(next)
      }

      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [maxHeight, minHeight],
  )

  return { height, setHeight, onResizePointerDown }
}
