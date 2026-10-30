import { useEffect } from 'react'
import { refreshTokenUsage } from '@/services/token-usage-store'

// The server's totals, re-read this often while the tab is visible (runs elsewhere, deployments)
const REFRESH_MS = 2 * 60 * 1000

/**
 * Keeps the token allowance current while the app is open: on load, every two minutes while the tab is
 * visible, and on returning to it. The chats' usage badges and the meters read what it stores. Renders nothing.
 */
export function TokenUsageSync() {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshTokenUsage()
    }
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return null
}
