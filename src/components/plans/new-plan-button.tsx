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
    try {
      const result = await createPlanAction(clientId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      router.push(`/clients/${clientId}/plans/${result.data.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <Fab label={busy ? 'Creating…' : 'New plan'} onClick={() => void create()} />
}
