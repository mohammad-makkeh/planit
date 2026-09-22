'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createEquipmentAction, updateEquipmentAction } from '@/actions/equipment'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { equipmentSchema } from '@/lib/validation'
import type { EquipmentWithUsage } from '@/services/equipment'

type FormValues = z.input<typeof equipmentSchema>

export function EquipmentFormSheet({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: EquipmentWithUsage
}) {
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<FormValues>({ resolver: zodResolver(equipmentSchema) })

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        name: equipment?.name ?? '',
        imageUrl: equipment?.imageUrl ?? '',
      })
    }
    wasOpen.current = open
  }, [open, equipment, reset])

  const imageUrl = watch('imageUrl')

  const onSubmit = handleSubmit(async (values) => {
    const result = equipment
      ? await updateEquipmentAction(equipment.id, values)
      : await createEquipmentAction(values)
    if (!result.ok) {
      if (result.error.code === 'conflict') setError('name', { message: result.error.message })
      toast.error(result.error.message)
      return
    }
    toast.success(equipment ? 'Equipment updated' : 'Equipment added')
    onOpenChange(false)
  })

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{equipment ? 'Edit equipment' : 'New equipment'}</BottomSheetTitle>
        </BottomSheetHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eq-name">Name</Label>
            <Input id="eq-name" {...register('name')} />
            {formState.errors.name && (
              <p className="text-sm text-destructive">{formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Image</Label>
            <ImageUploadField
              value={typeof imageUrl === 'string' && imageUrl !== '' ? imageUrl : undefined}
              onChange={(url) => setValue('imageUrl', url ?? '')}
              folder="equipment"
            />
            {formState.errors.imageUrl && (
              <p className="text-sm text-destructive">{formState.errors.imageUrl.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Saving…' : equipment ? 'Save changes' : 'Add equipment'}
          </Button>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
