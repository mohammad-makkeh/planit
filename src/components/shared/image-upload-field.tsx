'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImageAction } from '@/actions/uploads'
import { cn } from '@/lib/utils'

// Plain <img>: Supabase Storage URLs would need next/image remotePatterns config — not worth it in MVP.

export function ImageUploadField({
  value,
  onChange,
  folder,
  label = 'Image',
}: {
  value: string | undefined
  onChange: (url: string | undefined) => void
  folder: 'exercises' | 'logos' | 'equipment'
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => {
            e.preventDefault()
            if (uploading) return
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (uploading) return
            const f = e.dataTransfer.files?.[0]
            if (f) void onFile(f)
          }}
          className={cn(
            'flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-colors',
            dragOver ? 'border-brand bg-brand/5' : 'border-input hover:bg-accent',
          )}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="size-5 text-foreground opacity-40" />
          )}
          <span className="text-sm font-medium text-foreground">
            {uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
          </span>
          {!uploading && <span className="text-xs text-muted-foreground">PNG, JPG or WebP</span>}
        </button>
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
