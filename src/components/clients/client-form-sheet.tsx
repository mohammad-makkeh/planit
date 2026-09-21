'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createClientAction, updateClientAction } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { clientSchema } from '@/lib/validation'

type FormValues = z.input<typeof clientSchema>

export type ClientFormClient = {
  id: string
  name: string
  phone: string | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
  notes: string | null
}

export function ClientFormSheet({
  open,
  onOpenChange,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: ClientFormClient
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(clientSchema) })
  const { register, handleSubmit, reset, setError, formState } = form

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        name: client?.name ?? '',
        phone: client?.phone ?? '',
        age: client?.age ?? '',
        weightKg: client?.weightKg ?? '',
        heightCm: client?.heightCm ?? '',
        notes: client?.notes ?? '',
      } as FormValues)
    }
    wasOpen.current = open
  }, [open, client, reset])

  const onSubmit = handleSubmit(async (values) => {
    const result = client
      ? await updateClientAction(client.id, values)
      : await createClientAction(values)
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        setError(field as keyof FormValues, { message: messages[0] })
      }
      toast.error(result.error.message)
      return
    }
    toast.success(client ? 'Client updated' : 'Client added')
    onOpenChange(false)
  })

  const fieldError = (name: keyof FormValues) => formState.errors[name]?.message

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{client ? 'Edit client' : 'New client'}</BottomSheetTitle>
        </BottomSheetHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {fieldError('name') && <p className="text-sm text-destructive">{fieldError('name')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" inputMode="tel" {...register('phone')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" inputMode="numeric" {...register('age')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightKg">Weight (kg)</Label>
              <Input id="weightKg" type="number" step="0.1" inputMode="decimal" {...register('weightKg')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input id="heightCm" type="number" step="0.1" inputMode="decimal" {...register('heightCm')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register('notes')} />
          </div>
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Saving…' : client ? 'Save changes' : 'Add client'}
          </Button>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
