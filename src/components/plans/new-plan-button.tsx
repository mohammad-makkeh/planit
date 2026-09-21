'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlanAction } from '@/actions/plan-editor'
import { Fab } from '@/components/shell/fab'

export function NewPlanButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (busy) return
    setBusy(true)
    const result = await createPlanAction(clientId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    router.push(`/clients/${clientId}/plans/${result.data.id}`)
  }

  return <Fab label={busy ? 'Creating…' : 'New plan'} onClick={() => void create()} />
}
