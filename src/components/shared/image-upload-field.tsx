'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImageAction } from '@/actions/uploads'
import { Button } from '@/components/ui/button'

// Plain <img>: Supabase Storage URLs would need next/image remotePatterns config — not worth it in MVP.

export function ImageUploadField({
  value,
  onChange,
  folder,
  label = 'Image',
}: {
  value: string | undefined
  onChange: (url: string | undefined) => void
  folder: 'exercises' | 'logos'
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('folder', folder)
      const result = await uploadImageAction(formData)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      onChange(result.data.url)
    } catch {
      toast.error('Upload failed — try a smaller image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-24 w-24 rounded-xl border object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
