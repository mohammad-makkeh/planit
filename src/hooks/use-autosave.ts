'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { applyPlanPatchAction } from '@/actions/plan-editor'
import type { PlanPatch } from '@/lib/validation'

export type SaveStatus = 'saved' | 'dirty' | 'saving'

type FieldPatch = Record<string, unknown>

const DEBOUNCE_MS = 10_000

type Buffer = { plan: FieldPatch; sessions: Map<string, FieldPatch>; rows: Map<string, FieldPatch> }

function emptyBuffer(): Buffer {
  return { plan: {}, sessions: new Map(), rows: new Map() }
}

function mergeMaps(
  base: Record<string, FieldPatch> | undefined,
  overlay: Map<string, FieldPatch>,
): Map<string, FieldPatch> {
  const merged = new Map<string, FieldPatch>(Object.entries(base ?? {}))
  for (const [id, fields] of overlay) merged.set(id, { ...(merged.get(id) ?? {}), ...fields })
  return merged
}

export function useAutosave(planId: string) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const buffer = useRef<Buffer>(emptyBuffer())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)

  const hasPending = useCallback(() => {
    const b = buffer.current
    return Object.keys(b.plan).length > 0 || b.sessions.size > 0 || b.rows.size > 0
  }, [])

  const flush = useCallback(async (): Promise<boolean> => {
    // Bounded loop instead of recursion: each iteration either (a) waits out an
    // in-flight cycle and loops again if new work piled up meanwhile, or (b) runs
    // one flush cycle to completion and returns.
    for (;;) {
      if (inFlight.current) {
        // the in-flight promise doesn't cover edits queued after it started — once it
        // settles, check whether new work piled up and start a fresh cycle if so.
        const prior = await inFlight.current.catch(() => false)
        if (!hasPending()) return prior
        continue
      }
      if (!hasPending()) return true
      const b = buffer.current
      const patch: PlanPatch = {
        plan: Object.keys(b.plan).length > 0 ? (b.plan as PlanPatch['plan']) : undefined,
        sessions: b.sessions.size > 0 ? (Object.fromEntries(b.sessions) as PlanPatch['sessions']) : undefined,
        rows: b.rows.size > 0 ? (Object.fromEntries(b.rows) as PlanPatch['rows']) : undefined,
      }
      buffer.current = emptyBuffer()
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      setStatus('saving')

      // put the failed patch back UNDER any edits made meanwhile (newest wins)
      const requeueFailedPatch = () => {
        const later = buffer.current
        buffer.current = {
          plan: { ...(patch.plan ?? {}), ...later.plan },
          sessions: mergeMaps(patch.sessions, later.sessions),
          rows: mergeMaps(patch.rows, later.rows),
        }
        setStatus('dirty')
      }

      const scheduleRetry = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
      }

      const run = (async () => {
        try {
          const result = await applyPlanPatchAction(planId, patch)
          if (!result.ok) {
            requeueFailedPatch()
            if (result.error.code === 'validation') {
              // retrying identical invalid content is pointless — the next edit reschedules naturally
              toast.error('Could not save — a field is empty or too long.')
            } else {
              toast.error('Could not save — will retry. Check your connection.')
              scheduleRetry()
            }
            return false
          }
          setStatus(hasPending() ? 'dirty' : 'saved')
          return true
        } catch {
          // network-level rejection — treat exactly like a !result.ok failure
          requeueFailedPatch()
          toast.error('Could not save — will retry. Check your connection.')
          scheduleRetry()
          return false
        }
      })()
      inFlight.current = run
      try {
        return await run
      } finally {
        inFlight.current = null
      }
    }
  }, [planId, hasPending])

  const queueField = useCallback(
    (kind: 'plan' | 'session' | 'row', id: string, fields: FieldPatch) => {
      const b = buffer.current
      if (kind === 'plan') {
        b.plan = { ...b.plan, ...fields }
      } else {
        const map = kind === 'session' ? b.sessions : b.rows
        map.set(id, { ...(map.get(id) ?? {}), ...fields })
      }
      setStatus('dirty')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
    },
    [flush],
  )

  const runStructural = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      await flush()
      return fn()
    },
    [flush],
  )

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') void flush()
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasPending() || inFlight.current) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush, hasPending])

  return { status, queueField, flush, runStructural }
}
