'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createExerciseAction, updateExerciseAction } from '@/actions/exercises'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exerciseSchema } from '@/lib/validation'
import type { ExerciseWithTags } from '@/services/exercises'
import { ExerciseDeleteDialog } from './exercise-delete-dialog'
import { TagMultiSelect, type TagOption } from './tag-multi-select'

type FormValues = z.input<typeof exerciseSchema>

export function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  tagOptions,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise?: ExerciseWithTags
  tagOptions: TagOption[]
  onCreated?: (id: string) => void
}) {
  const [localTags, setLocalTags] = useState<TagOption[]>(tagOptions)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<FormValues>({ resolver: zodResolver(exerciseSchema) })

  useEffect(() => {
    if (open) {
      setLocalTags(tagOptions)
      reset({
        name: exercise?.name ?? '',
        imageUrl: exercise?.imageUrl ?? '',
        tutorialUrl: exercise?.tutorialUrl ?? '',
        tagIds: exercise?.tags.map((t) => t.id) ?? [],
      })
    }
  }, [open, exercise, tagOptions, reset])

  const imageUrl = watch('imageUrl')
  const tagIds = watch('tagIds') ?? []

  const onSubmit = handleSubmit(async (values) => {
    const result = exercise
      ? await updateExerciseAction(exercise.id, values)
      : await createExerciseAction(values)
    if (!result.ok) {
      if (result.error.code === 'conflict') setError('name', { message: result.error.message })
      toast.error(result.error.message)
      return
    }
    toast.success(exercise ? 'Move updated' : 'Move added')
    onOpenChange(false)
    if (!exercise) onCreated?.(result.data.id)
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{exercise ? 'Edit move' : 'New move'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ex-name">Name</Label>
              <Input id="ex-name" {...register('name')} autoFocus={!exercise} />
              {formState.errors.name && (
                <p className="text-sm text-destructive">{formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <ImageUploadField
                value={typeof imageUrl === 'string' && imageUrl !== '' ? imageUrl : undefined}
                onChange={(url) => setValue('imageUrl', url ?? '')}
                folder="exercises"
              />
              <Input placeholder="…or paste an image URL" {...register('imageUrl')} />
              {formState.errors.imageUrl && (
                <p className="text-sm text-destructive">{formState.errors.imageUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-tutorial">Tutorial link</Label>
              <Input id="ex-tutorial" inputMode="url" placeholder="https://…" {...register('tutorialUrl')} />
              {formState.errors.tutorialUrl && (
                <p className="text-sm text-destructive">{formState.errors.tutorialUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagMultiSelect
                options={localTags}
                value={tagIds}
                onChange={(ids) => setValue('tagIds', ids)}
                onCreated={(tag) => setLocalTags((prev) => [...prev, tag])}
              />
            </div>
            <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Saving…' : exercise ? 'Save changes' : 'Add move'}
            </Button>
            {exercise && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" /> Delete move
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
      {exercise && (
        <ExerciseDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          exercise={exercise}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  )
}
