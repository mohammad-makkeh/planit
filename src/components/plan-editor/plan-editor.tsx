'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  createSessionAction, reorderSessionsAction, updatePlanMetaAction,
} from '@/actions/plan-editor'
import type { TagOption } from '@/components/library/tag-multi-select'
import { useAutosave } from '@/hooks/use-autosave'
import type { ActionResult } from '@/lib/action-result'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorPlan, EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { EditorHeader } from './editor-header'
import { SessionChips } from './session-chips'

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
      } finally {
        setStructuralBusy(false)
      }
    },
    [applyResult, runStructural, structuralBusy],
  )

  const setTitle = useCallback(
    (title: string) => {
      setDoc((d) => ({ ...d, title }))
      queueField('plan', initial.id, { title })
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
      queueField('session', sessionId, fields)
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

  // consumed by SessionPanel/rows in Tasks 6–7; referenced here to keep lint clean until then
  void exercises
  void tags
  void warmups
  void setSessionField
  void setRowField

  return (
    <div className="min-h-dvh">
      <EditorHeader
        plan={doc}
        saveStatus={status}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
        onSave={() => void flush()}
        onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
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
          // SessionPanel arrives in the next task
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Session “{activeSession.label}” — content editor arrives in the next task.
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sessions — add one with the + button above.
          </div>
        )}
      </main>
    </div>
  )
}
