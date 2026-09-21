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
    if (inFlight.current) return inFlight.current
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
    const run = (async () => {
      const result = await applyPlanPatchAction(planId, patch)
      if (!result.ok) {
        // put the failed patch back UNDER any edits made meanwhile (newest wins)
        const later = buffer.current
        buffer.current = {
          plan: { ...(patch.plan ?? {}), ...later.plan },
          sessions: mergeMaps(patch.sessions, later.sessions),
          rows: mergeMaps(patch.rows, later.rows),
        }
        setStatus('dirty')
        toast.error('Could not save — will retry. Check your connection.')
        return false
      }
      setStatus(hasPending() ? 'dirty' : 'saved')
      return true
    })()
    inFlight.current = run
    const outcome = await run
    inFlight.current = null
    return outcome
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
