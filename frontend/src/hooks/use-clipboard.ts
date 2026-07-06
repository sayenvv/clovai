import { useCallback, useState } from 'react'
import { toast } from 'sonner'

interface UseCopyToClipboardOptions {
  resetMs?: number
  errorMessage?: string
}

/** Copy text to the clipboard with optional toast feedback and a transient copied flag. */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
  const { resetMs = 2000, errorMessage = 'Could not copy to clipboard' } = options
  const [copied, setCopied] = useState(false)

  const resetCopied = useCallback(() => setCopied(false), [])

  const copy = useCallback(
    async (text: string, successMessage?: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (successMessage) toast.success(successMessage)
        window.setTimeout(() => setCopied(false), resetMs)
        return true
      } catch {
        toast.error(errorMessage)
        return false
      }
    },
    [errorMessage, resetMs],
  )

  return { copied, copy, resetCopied }
}
