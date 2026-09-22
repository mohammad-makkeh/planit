'use server'

import { err, ok, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { uploadImage } from '@/lib/storage'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await requireCoachId()
  const file = formData.get('file')
  const folder = formData.get('folder')

  if (!(file instanceof File) || file.size === 0) return err('validation', 'Choose an image file.')
  if (file.size > MAX_BYTES) return err('validation', 'Image must be 4MB or smaller.')
  if (!ALLOWED_TYPES.includes(file.type)) return err('validation', 'Use a JPG, PNG, or WebP image.')
  if (folder !== 'exercises' && folder !== 'logos' && folder !== 'equipment') {
    return err('validation', 'Invalid upload folder.')
  }

  try {
    const url = await uploadImage(file, folder)
    return ok({ url })
  } catch (e) {
    return err('unknown', e instanceof Error ? e.message : 'Upload failed')
  }
}
