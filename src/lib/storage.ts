import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

const BUCKET = 'planit-public'

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key)
}

export async function uploadImage(
  file: File,
  folder: 'logos',
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${folder}/${nanoid(12)}.${ext}`
  const supabase = supabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
