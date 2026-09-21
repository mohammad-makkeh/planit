'use client'

import { useState } from 'react'
import { Fab } from '@/components/shell/fab'
import { ClientFormSheet } from './client-form-sheet'

export function NewClientButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Fab label="New client" onClick={() => setOpen(true)} />
      <ClientFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
