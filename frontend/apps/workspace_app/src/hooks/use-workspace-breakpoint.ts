import { useEffect, useState } from 'react'

/** Matches designer “desktop workspace” layout (≥ lg). */
export const WORKSPACE_DESKTOP_QUERY = '(min-width: 1024px)'

/** `null` while matching (first paint); then boolean. */
export function useWorkspaceBreakpoint() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    return window.matchMedia(WORKSPACE_DESKTOP_QUERY).matches
  })

  useEffect(() => {
    const media = window.matchMedia(WORKSPACE_DESKTOP_QUERY)
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return {
    isDesktop: isDesktop !== false,
    isMobile: isDesktop === false,
    isReady: isDesktop !== null,
  }
}
