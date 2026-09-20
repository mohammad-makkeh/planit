'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { updateProfileAction } from '@/actions/coaches'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { profileSchema } from '@/lib/validation'

type FormValues = z.input<typeof profileSchema>

export type CoachProfile = {
  name: string
  title: string | null
  phone: string | null
  email: string
  brandColor: string | null
  logoUrl: string | null
}

export function ProfileForm({ coach }: { coach: CoachProfile }) {
  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: coach.name,
      title: coach.title ?? '',
      phone: coach.phone ?? '',
      email: coach.email,
      brandColor: coach.brandColor ?? '#FE2E00',
      logoUrl: coach.logoUrl ?? '',
    },
  })

  const logoUrl = watch('logoUrl')
  const brandColor = watch('brandColor')

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateProfileAction(values)
    if (!result.ok) {
      if (result.error.code === 'conflict') setError('email', { message: result.error.message })
      toast.error(result.error.message)
      return
    }
    toast.success('Profile saved')
  })

  const fieldError = (name: keyof FormValues) => formState.errors[name]?.message

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Logo</Label>
        <ImageUploadField
          value={typeof logoUrl === 'string' && logoUrl !== '' ? logoUrl : undefined}
          onChange={(url) => setValue('logoUrl', url ?? '')}
          folder="logos"
          label="Logo"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" {...register('name')} />
        {fieldError('name') && <p className="text-sm text-destructive">{fieldError('name')}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-title">Title</Label>
        <Input id="p-title" placeholder="Certified PT & Fitness Nutritionist" {...register('title')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-phone">Phone</Label>
        <Input id="p-phone" type="tel" inputMode="tel" {...register('phone')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-email">Email</Label>
        <Input id="p-email" type="email" {...register('email')} />
        {fieldError('email') && <p className="text-sm text-destructive">{fieldError('email')}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-color">Brand color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof brandColor === 'string' && brandColor ? brandColor : '#FE2E00'}
            onChange={(e) => setValue('brandColor', e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-background"
            aria-label="Pick brand color"
          />
          <Input id="p-color" className="max-w-32" {...register('brandColor')} />
        </div>
        {fieldError('brandColor') && (
          <p className="text-sm text-destructive">{fieldError('brandColor')}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
