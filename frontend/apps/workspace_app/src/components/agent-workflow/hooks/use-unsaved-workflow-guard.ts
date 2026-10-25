import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { DiagramDocument } from '@/components/designer/diagram-types'

function workflowFingerprint(doc: DiagramDocument, testInput: string): string {
  // Validating (also before every run) writes status and the inferred execution type;
  // they are not edits, so they never make the workflow unsaved.
  const { status: _status, executionType: _executionType, ...workflow } = doc.workflow ?? {}
  return JSON.stringify({
    pages: doc.pages,
    workflow,
    testInput,
  })
}

interface PendingNavigation {
  run: () => void
}

/** Track unsaved edits and warn before closing the browser or leaving the app. */
export function useUnsavedWorkflowGuard(doc: DiagramDocument, testInput: string) {
  const fingerprint = useMemo(() => workflowFingerprint(doc, testInput), [doc, testInput])
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const pendingRef = useRef<PendingNavigation | null>(null)
  const saveHandlerRef = useRef<(() => void | Promise<void>) | null>(null)
  const isDirtyRef = useRef(false)

  const isDirty = fingerprint !== savedFingerprint
  isDirtyRef.current = isDirty

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useBeforeUnload(
    useCallback((event) => {
      if (!isDirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }, []),
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    pendingRef.current = {
      run: () => blocker.proceed?.(),
    }
    setDialogOpen(true)
  }, [blocker.state, blocker])

  /** Pass the saved doc when the save itself changed it (e.g. version bump). */
  const markSaved = useCallback(
    (savedDoc?: DiagramDocument) => {
      setSavedFingerprint(savedDoc ? workflowFingerprint(savedDoc, testInput) : fingerprint)
    },
    [fingerprint, testInput],
  )

  const registerSaveHandler = useCallback((handler: () => void | Promise<void>) => {
    saveHandlerRef.current = handler
  }, [])

  const guardAction = useCallback(
    (run: () => void) => {
      if (!isDirty) {
        run()
        return
      }
      pendingRef.current = { run }
      setDialogOpen(true)
    },
    [isDirty],
  )

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    pendingRef.current = null
    if (blocker.state === 'blocked') blocker.reset?.()
  }, [blocker])

  const discardPending = useCallback(() => {
    const pending = pendingRef.current
    setSavedFingerprint(fingerprint)
    setDialogOpen(false)
    pendingRef.current = null
    if (blocker.state === 'blocked') blocker.proceed?.()
    pending?.run()
  }, [blocker, fingerprint])

  const saveAndContinue = useCallback(async () => {
    if (!saveHandlerRef.current) {
      discardPending()
      return
    }
    setIsSaving(true)
    try {
      await saveHandlerRef.current()
      const pending = pendingRef.current
      setDialogOpen(false)
      pendingRef.current = null
      if (blocker.state === 'blocked') blocker.proceed?.()
      pending?.run()
    } finally {
      setIsSaving(false)
    }
  }, [blocker, discardPending])

  return {
    isDirty,
    dialogOpen,
    setDialogOpen,
    isSaving,
    guardAction,
    closeDialog,
    discardPending,
    saveAndContinue,
    markSaved,
    registerSaveHandler,
  }
}
