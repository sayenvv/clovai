import { useEffect, useRef, useState } from 'react'

/**
 * Whether the element is on screen, from an IntersectionObserver. `once` keeps it true after the first time;
 * `margin` shrinks or grows the viewport (a CSS margin, such as "-45% 0px").
 */
export function useInViewport<T extends Element = HTMLDivElement>({ once = false, margin = '0px' } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting)
        if (once && !visible) return
        setInView(visible)
        if (once && visible) observer.disconnect()
      },
      { rootMargin: margin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [once, margin])
  return [ref, inView] as const
}
