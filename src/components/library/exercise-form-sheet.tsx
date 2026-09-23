'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createExerciseAction, updateExerciseAction } from '@/actions/exercises'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exerciseSchema, movementTypes, type MovementType } from '@/lib/validation'
import { cn } from '@/lib/utils'
import type { ExerciseWithDetails } from '@/services/exercises'
import {
  CatalogPickerField, type CatalogOption, type EquipmentOption,
} from './catalog-picker-field'
import { ExerciseDeleteDialog } from './exercise-delete-dialog'

type FormValues = z.input<typeof exerciseSchema>

const movementTypeLabels: Record<MovementType, string> = {
  push: 'Push',
  pull: 'Pull',
  static: 'Static',
}

function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
    active
      ? 'border-transparent bg-brand text-brand-foreground'
      : 'border-input bg-background text-foreground hover:bg-accent',
  )
}

export function ExerciseFormSheet({
  open,
  onOpenChange,
  exercise,
  muscleTargetOptions,
  equipmentOptions,
  initialName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise?: ExerciseWithDetails
  muscleTargetOptions: CatalogOption[]
  equipmentOptions: EquipmentOption[]
  initialName?: string
  onCreated?: (exercise: { id: string; name: string; imageUrl: string | null }) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<FormValues>({ resolver: zodResolver(exerciseSchema) })

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      const fallbackId = equipmentOptions.find((o) => o.isFallback)!.id
      reset({
        name: exercise?.name ?? initialName ?? '',
        imageUrl: exercise?.imageUrl ?? '',
        tutorialUrl: exercise?.tutorialUrl ?? '',
        muscleTargetIds: exercise?.muscleTargets.map((m) => m.id) ?? [],
        movementType: exercise?.movementType ?? 'static',
        equipmentIds: exercise
          ? [
              exercise.defaultEquipmentId,
              ...exercise.equipment.map((e) => e.id).filter((id) => id !== exercise.defaultEquipmentId),
            ]
          : [fallbackId],
      })
    }
    wasOpen.current = open
  }, [open, exercise, equipmentOptions, initialName, reset])

  const imageUrl = watch('imageUrl')
  const muscleTargetIds = watch('muscleTargetIds') ?? []
  const movementType = watch('movementType')
  const equipmentIds = watch('equipmentIds') ?? []

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
    if (!exercise) {
      onCreated?.({
        id: result.data.id,
        name: values.name,
        imageUrl: typeof values.imageUrl === 'string' && values.imageUrl !== '' ? values.imageUrl : null,
      })
    }
  })

  return (
    <>
      <BottomSheet open={open && !deleteOpen} onOpenChange={onOpenChange}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>{exercise ? 'Edit move' : 'New move'}</BottomSheetTitle>
          </BottomSheetHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ex-name">Name</Label>
              <Input id="ex-name" {...register('name')} />
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
              <Label>Movement type</Label>
              <div className="flex gap-2">
                {movementTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={chipClass(movementType === type)}
                    onClick={() => setValue('movementType', type)}
                  >
                    {movementTypeLabels[type]}
                  </button>
                ))}
              </div>
              {formState.errors.movementType && (
                <p className="text-sm text-destructive">{formState.errors.movementType.message}</p>
              )}
            </div>
            <CatalogPickerField
              label="Equipment"
              sheetTitle="Add equipment"
              options={equipmentOptions}
              value={equipmentIds}
              onChange={(ids) => setValue('equipmentIds', ids, { shouldValidate: formState.isSubmitted })}
              showIcons
              error={formState.errors.equipmentIds?.message}
            />
            <CatalogPickerField
              label="Muscle targets"
              sheetTitle="Add muscle targets"
              options={muscleTargetOptions}
              value={muscleTargetIds}
              onChange={(ids) => setValue('muscleTargetIds', ids)}
            />
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
        </BottomSheetContent>
      </BottomSheet>
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
