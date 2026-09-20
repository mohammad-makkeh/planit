'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-20 right-4 z-40 h-14 rounded-full px-5 shadow-lg md:bottom-8 md:right-8"
    >
      <Plus className="size-5" />
      {label}
    </Button>
  )
}
