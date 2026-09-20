'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function ClientSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      const q = value.trim()
      router.replace(q ? `/?q=${encodeURIComponent(q)}` : '/')
    }, 300)
    return () => clearTimeout(t)
  }, [value, router])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search clients…"
        className="pl-9"
        inputMode="search"
      />
    </div>
  )
}
