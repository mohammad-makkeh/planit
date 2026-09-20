'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteExerciseAction, getExerciseUsageAction } from '@/actions/exercises'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ExerciseUsage } from '@/services/exercises'

export function ExerciseDeleteDialog({
  open,
  onOpenChange,
  exercise,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: { id: string; name: string }
  onDeleted: () => void
}) {
  const [usage, setUsage] = useState<ExerciseUsage | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsage(null)
    void getExerciseUsageAction(exercise.id).then((result) => {
      if (!mounted) return
      if (result.ok) setUsage(result.data)
      else toast.error(result.error.message)
    })
    return () => {
      mounted = false
    }
  }, [open, exercise.id])

  async function onDelete() {
    setDeleting(true)
    const result = await deleteExerciseAction(exercise.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Move deleted')
    onOpenChange(false)
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {exercise.name}?</DialogTitle>
        </DialogHeader>
        {usage === null ? (
          <Skeleton className="h-10 w-full" />
        ) : usage.rowCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            This move is used in <strong>{usage.rowCount}</strong>{' '}
            {usage.rowCount === 1 ? 'row' : 'rows'} across <strong>{usage.planCount}</strong>{' '}
            {usage.planCount === 1 ? 'plan' : 'plans'}. Deleting it removes those rows from the
            plans <strong>permanently</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This move is not used in any plan. Deleting it is permanent.
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleting || usage === null}>
            {deleting ? 'Deleting…' : 'Delete move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
