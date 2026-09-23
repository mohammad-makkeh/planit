'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { savePlanDocumentAction } from '@/actions/plan-editor'
import type { CatalogOption, EquipmentOption } from '@/components/library/catalog-picker-field'
import type { PlanDocument } from '@/lib/validation'
import type { ExerciseWithDetails } from '@/services/exercises'
import type { EditorPlan, EditorRow, EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { EditorHeader } from './editor-header'
import { WeekBalanceButton } from './week-balance-button'
import { ExerciseRows } from './exercise-rows'
import { SessionChips } from './session-chips'
import { SessionPanel } from './session-panel'

export type SessionFieldPatch = Partial<
  Pick<
    EditorSession,
    'label' | 'weekday' | 'warmupLines' | 'cardioMinutes' | 'cardioBpm' | 'cardioIncline'
  >
>

export type RowFieldPatch = Partial<
  Pick<EditorRow, 'sets' | 'reps' | 'speed' | 'oneRm' | 'rest' | 'note'>
>

export type PickedExercise = { id: string; name: string }

function toDocument(plan: EditorPlan): PlanDocument {
  return {
    title: plan.title.trim(),
    sessions: plan.sessions.map((s) => ({
      label: s.label.trim(),
      weekday: s.weekday,
      warmupLines: s.warmupLines,
      cardioMinutes: s.cardioMinutes,
      cardioBpm: s.cardioBpm,
      cardioIncline: s.cardioIncline,
      rows: s.rows.map((r) => ({
        exerciseId: r.exercise.id,
        equipmentId: r.equipmentId ?? null,
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
  muscleTargets,
  warmups,
  equipmentOptions,
}: {
  initial: EditorPlan
  exercises: ExerciseWithDetails[]
  muscleTargets: CatalogOption[]
  warmups: WarmupPreset[]
  equipmentOptions: EquipmentOption[]
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
        const firstField = Object.entries(result.error.fieldErrors ?? {})[0]
        toast.error(
          firstField ? `${result.error.message} (${firstField[0]}: ${firstField[1][0]})` : result.error.message,
        )
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
    (sessionId: string, rowId: string, fields: RowFieldPatch) => {
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
          warmupLines: [],
          cardioMinutes: null,
          cardioBpm: null,
          cardioIncline: null,
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
    (sessionId: string, exercise: PickedExercise, equipmentId: string | null) => {
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
                    equipmentId,
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
    (sessionId: string, rowId: string, exercise: PickedExercise, equipmentId: string | null) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, exercise, equipmentId } : r)) }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const setRowEquipment = useCallback(
    (sessionId: string, rowId: string, equipmentId: string | null) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, equipmentId } : r)) }
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
  // Live from the unsaved document, so the balance follows every edit.
  const musclesByExercise = new Map(exercises.map((e) => [e.id, e.muscleTargets]))
  const weekRows = doc.sessions.flatMap((s) =>
    s.rows.map((r) => ({ muscles: musclesByExercise.get(r.exercise.id) ?? [], sets: r.sets })),
  )

  return (
    <div className="min-h-dvh">
      {/* Header + day chips share one sticky layer so the chips sit directly beneath the
          header by construction — no magic pixel offset that would drift if the header's
          height changes (e.g. wrapping at narrow widths). */}
      <div className="sticky top-0 z-30">
        <EditorHeader
          plan={doc}
          dirty={dirty}
          saving={saving}
          onTitleChange={(title) => mutate((d) => ({ ...d, title }))}
          onSave={() => void save()}
          onEnsureSaved={save}
          onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
          titleAccessory={
            <WeekBalanceButton
              title={doc.title}
              rows={weekRows}
              catalog={muscleTargets.map((m) => m.name)}
              exercises={exercises}
              days={doc.sessions.map((s) => ({ id: s.id, label: s.label }))}
              onAdd={(dayId, exercise) => addRow(dayId, exercise, null)}
            />
          }
        />
        <SessionChips
          sessions={doc.sessions}
          activeSessionId={activeSessionId}
          onSelect={setActiveSessionId}
          onAdd={addSession}
          onReorder={reorderSessions}
        />
      </div>
      <main className="px-4 pt-4 pb-8 md:px-8">
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
              muscleTargets={muscleTargets}
              equipmentOptions={equipmentOptions}
              onRowField={(rowId, fields) => setRowField(activeSession.id, rowId, fields)}
              onAdd={(exercise, equipmentId) => addRow(activeSession.id, exercise, equipmentId)}
              onSwap={(rowId, exercise, equipmentId) =>
                swapRow(activeSession.id, rowId, exercise, equipmentId)
              }
              onDuplicate={(rowId) => duplicateRow(activeSession.id, rowId)}
              onDelete={(rowId) => deleteRow(activeSession.id, rowId)}
              onReorder={(orderedIds) => reorderRows(activeSession.id, orderedIds)}
              onRowEquipment={(rowId, equipmentId) =>
                setRowEquipment(activeSession.id, rowId, equipmentId)
              }
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
