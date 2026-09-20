'use client'

import { useState } from 'react'
import { Fab } from '@/components/shell/fab'
import { ClientFormDialog } from './client-form-dialog'

export function NewClientButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Fab label="New client" onClick={() => setOpen(true)} />
      <ClientFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
