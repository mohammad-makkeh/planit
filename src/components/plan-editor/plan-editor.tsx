'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { savePlanDocumentAction } from '@/actions/plan-editor'
import type { TagOption } from '@/components/library/tag-multi-select'
import type { PlanDocument } from '@/lib/validation'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorPlan, EditorRow, EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { EditorHeader } from './editor-header'
import { ExerciseRows } from './exercise-rows'
import { SessionChips } from './session-chips'
import { SessionPanel } from './session-panel'

export type SessionFieldPatch = Partial<
  Pick<EditorSession, 'label' | 'weekday' | 'focusNote' | 'warmupLines' | 'cardioTime' | 'cardioHrm'>
>

export type PickedExercise = { id: string; name: string; imageUrl: string | null }

function toDocument(plan: EditorPlan): PlanDocument {
  return {
    title: plan.title.trim(),
    status: plan.status,
    sessions: plan.sessions.map((s) => ({
      label: s.label.trim(),
      weekday: s.weekday,
      focusNote: s.focusNote,
      warmupLines: s.warmupLines,
      cardioTime: s.cardioTime,
      cardioHrm: s.cardioHrm,
      rows: s.rows.map((r) => ({
        exerciseId: r.exercise.id,
        sets: r.sets,
        reps: r.reps,
        speed: r.speed,
        oneRm: r.oneRm,
        rest: r.rest,
        note: r.note,
      })),
    })),
  }
}

export function PlanEditor({
  initial,
  exercises,
  tags,
  warmups,
}: {
  initial: EditorPlan
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  warmups: WarmupPreset[]
}) {
  const [doc, setDoc] = useState<EditorPlan>(initial)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial.sessions[0]?.id ?? null,
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const editCount = useRef(0)
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  /** Every local mutation goes through here — instant, no server calls. */
  const mutate = useCallback((updater: (d: EditorPlan) => EditorPlan) => {
    editCount.current += 1
    setDirty(true)
    setDoc(updater)
  }, [])

  const save = useCallback(async (): Promise<boolean> => {
    if (saving) return false
    if (!dirty) return true
    const current = docRef.current
    if (current.title.trim() === '') {
      toast.error('Give the plan a title before saving.')
      return false
    }
    if (current.sessions.some((s) => s.label.trim() === '')) {
      toast.error('Every day needs a label before saving.')
      return false
    }
    setSaving(true)
    const startCount = editCount.current
    try {
      const result = await savePlanDocumentAction(current.id, toDocument(current))
      if (!result.ok) {
        toast.error(result.error.message)
        return false
      }
      if (editCount.current === startCount) setDirty(false)
      return true
    } catch {
      toast.error('Could not save — check your connection and try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [dirty, saving])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ----- local document mutations -----

  const setSessionField = useCallback(
    (sessionId: string, fields: SessionFieldPatch) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, ...fields } : s)),
      }))
    },
    [mutate],
  )

  const setRowField = useCallback(
    (sessionId: string, rowId: string, fields: Record<string, string | null>) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...fields } : r)) }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const addSession = useCallback(() => {
    const id = crypto.randomUUID()
    mutate((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        {
          id,
          position: d.sessions.length + 1,
          label: `Day ${d.sessions.length + 1}`,
          weekday: null,
          focusNote: null,
          warmupLines: [],
          cardioTime: null,
          cardioHrm: null,
          rows: [],
        },
      ],
    }))
    setActiveSessionId(id)
  }, [mutate])

  const duplicateSession = useCallback(
    (sessionId: string) => {
      const id = crypto.randomUUID()
      mutate((d) => {
        const source = d.sessions.find((s) => s.id === sessionId)
        if (!source) return d
        const copy: EditorSession = {
          ...source,
          id,
          position: d.sessions.length + 1,
          label: `${source.label} (copy)`,
          warmupLines: source.warmupLines.map((l) => ({ ...l })),
          rows: source.rows.map((r) => ({
            ...r,
            id: crypto.randomUUID(),
            exercise: { ...r.exercise },
          })),
        }
        return { ...d, sessions: [...d.sessions, copy] }
      })
      setActiveSessionId(id)
    },
    [mutate],
  )

  const deleteSession = useCallback(
    (sessionId: string) => {
      const remaining = docRef.current.sessions.filter((s) => s.id !== sessionId)
      mutate((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== sessionId) }))
      setActiveSessionId((current) =>
        current === sessionId ? (remaining[0]?.id ?? null) : current,
      )
    },
    [mutate],
  )

  const reorderSessions = useCallback(
    (orderedIds: string[]) => {
      mutate((d) => ({
        ...d,
        sessions: orderedIds
          .map((id) => d.sessions.find((s) => s.id === id))
          .filter((s): s is EditorSession => s !== undefined),
      }))
    },
    [mutate],
  )

  const addRow = useCallback(
    (sessionId: string, exercise: PickedExercise) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                rows: [
                  ...s.rows,
                  {
                    id: crypto.randomUUID(),
                    position: s.rows.length + 1,
                    sets: null,
                    reps: null,
                    speed: null,
                    oneRm: null,
                    rest: null,
                    note: null,
                    exercise,
                  },
                ],
              }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const swapRow = useCallback(
    (sessionId: string, rowId: string, exercise: PickedExercise) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, exercise } : r)) }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const duplicateRow = useCallback(
    (sessionId: string, rowId: string) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) => {
          if (s.id !== sessionId) return s
          const index = s.rows.findIndex((r) => r.id === rowId)
          const source = index === -1 ? undefined : s.rows[index]
          if (!source) return s
          const copy: EditorRow = {
            ...source,
            id: crypto.randomUUID(),
            exercise: { ...source.exercise },
          }
          const rows = [...s.rows]
          rows.splice(index + 1, 0, copy)
          return { ...s, rows }
        }),
      }))
    },
    [mutate],
  )

  const deleteRow = useCallback(
    (sessionId: string, rowId: string) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s,
        ),
      }))
    },
    [mutate],
  )

  const reorderRows = useCallback(
    (sessionId: string, orderedIds: string[]) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                rows: orderedIds
                  .map((id) => s.rows.find((r) => r.id === id))
                  .filter((r): r is EditorRow => r !== undefined),
              }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const activeSession = doc.sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="min-h-dvh">
      <EditorHeader
        plan={doc}
        dirty={dirty}
        saving={saving}
        onTitleChange={(title) => mutate((d) => ({ ...d, title }))}
        onStatusChange={(status) => mutate((d) => ({ ...d, status }))}
        onSave={() => void save()}
        onEnsureSaved={save}
        onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
      />
      <SessionChips
        sessions={doc.sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onAdd={addSession}
        onReorder={reorderSessions}
      />
      <main className="px-4 pb-8 md:px-8">
        {activeSession ? (
          <SessionPanel
            session={activeSession}
            warmups={warmups}
            onField={(fields) => setSessionField(activeSession.id, fields)}
            onDuplicate={() => duplicateSession(activeSession.id)}
            onDelete={() => deleteSession(activeSession.id)}
          >
            <ExerciseRows
              session={activeSession}
              exercises={exercises}
              tags={tags}
              onRowField={(rowId, fields) => setRowField(activeSession.id, rowId, fields)}
              onAdd={(exercise) => addRow(activeSession.id, exercise)}
              onSwap={(rowId, exercise) => swapRow(activeSession.id, rowId, exercise)}
              onDuplicate={(rowId) => duplicateRow(activeSession.id, rowId)}
              onDelete={(rowId) => deleteRow(activeSession.id, rowId)}
              onReorder={(orderedIds) => reorderRows(activeSession.id, orderedIds)}
            />
          </SessionPanel>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sessions — add one with the + button above.
          </div>
        )}
      </main>
    </div>
  )
}
