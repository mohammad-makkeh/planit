'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  createRowAction, createSessionAction, deleteRowAction, deleteSessionAction, duplicateRowAction,
  duplicateSessionAction, reorderRowsAction, reorderSessionsAction, swapRowExerciseAction, updatePlanMetaAction,
} from '@/actions/plan-editor'
import type { TagOption } from '@/components/library/tag-multi-select'
import { useAutosave } from '@/hooks/use-autosave'
import type { ActionResult } from '@/lib/action-result'
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
  const [structuralBusy, setStructuralBusy] = useState(false)
  const { status, queueField, flush, runStructural } = useAutosave(doc.id)

  /** Replace the document with a structural action's fresh payload. */
  const applyResult = useCallback((result: ActionResult<EditorPlan>): boolean => {
    if (!result.ok) {
      toast.error(result.error.message)
      return false
    }
    setDoc(result.data)
    setActiveSessionId((current) =>
      current && result.data.sessions.some((s) => s.id === current)
        ? current
        : (result.data.sessions[0]?.id ?? null),
    )
    return true
  }, [])

  /** Structural op wrapper: flush pending edits, run, apply payload. */
  const structural = useCallback(
    async (fn: () => Promise<ActionResult<EditorPlan>>) => {
      if (structuralBusy) return
      setStructuralBusy(true)
      try {
        const result = await runStructural(fn)
        applyResult(result)
      } catch {
        toast.error('Something went wrong. Please try again.')
      } finally {
        setStructuralBusy(false)
      }
    },
    [applyResult, runStructural, structuralBusy],
  )

  const setTitle = useCallback(
    (title: string) => {
      setDoc((d) => ({ ...d, title }))
      // an empty title fails schema validation (min 1) — don't poison the buffer with it
      if (title.trim() !== '') queueField('plan', initial.id, { title })
    },
    [initial.id, queueField],
  )

  const setStatus = useCallback(
    (status: EditorPlan['status']) => {
      void structural(() => updatePlanMetaAction(doc.id, { status }))
    },
    [doc.id, structural],
  )

  const setSessionField = useCallback(
    (sessionId: string, fields: SessionFieldPatch) => {
      setDoc((d) => ({
        ...d,
        sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, ...fields } : s)),
      }))
      // an empty label fails schema validation (min 1) — keep it local-only until it's non-empty
      const queued: SessionFieldPatch = { ...fields }
      if ('label' in queued && !queued.label?.trim()) delete queued.label
      if (Object.keys(queued).length > 0) queueField('session', sessionId, queued)
    },
    [queueField],
  )

  const setRowField = useCallback(
    (sessionId: string, rowId: string, fields: Record<string, string | null>) => {
      setDoc((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...fields } : r)) }
            : s,
        ),
      }))
      queueField('row', rowId, fields)
    },
    [queueField],
  )

  const activeSession = doc.sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="min-h-dvh">
      <EditorHeader
        plan={doc}
        saveStatus={status}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
        onSave={() => void flush()}
        onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
        onFlushPending={flush}
      />
      <SessionChips
        sessions={doc.sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onAdd={() => void structural(() => createSessionAction(doc.id))}
        onReorder={(orderedIds) => {
          setDoc((d) => ({
            ...d,
            sessions: orderedIds
              .map((id) => d.sessions.find((s) => s.id === id))
              .filter((s): s is EditorSession => s !== undefined),
          }))
          void structural(() => reorderSessionsAction(doc.id, orderedIds))
        }}
        adding={structuralBusy}
      />
      <main className="px-4 pb-8 md:px-8">
        {activeSession ? (
          <SessionPanel
            session={activeSession}
            warmups={warmups}
            busy={structuralBusy}
            onField={(fields) => setSessionField(activeSession.id, fields)}
            onDuplicate={() => void structural(() => duplicateSessionAction(doc.id, activeSession.id))}
            onDelete={() => void structural(() => deleteSessionAction(doc.id, activeSession.id))}
          >
            <ExerciseRows
              session={activeSession}
              exercises={exercises}
              tags={tags}
              busy={structuralBusy}
              onRowField={(rowId, fields) => setRowField(activeSession.id, rowId, fields)}
              onAdd={(exerciseId) =>
                void structural(() => createRowAction(doc.id, activeSession.id, exerciseId))
              }
              onSwap={(rowId, exerciseId) =>
                void structural(() => swapRowExerciseAction(doc.id, rowId, exerciseId))
              }
              onDuplicate={(rowId) => void structural(() => duplicateRowAction(doc.id, rowId))}
              onDelete={(rowId) => void structural(() => deleteRowAction(doc.id, rowId))}
              onReorder={(orderedIds) => {
                setDoc((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id === activeSession.id
                      ? {
                          ...s,
                          rows: orderedIds
                            .map((id) => s.rows.find((r) => r.id === id))
                            .filter((r): r is EditorRow => r !== undefined),
                        }
                      : s,
                  ),
                }))
                void structural(() => reorderRowsAction(doc.id, activeSession.id, orderedIds))
              }}
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
