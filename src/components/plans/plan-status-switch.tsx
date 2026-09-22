'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePlanMetaAction } from '@/actions/plan-editor'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { Plan } from '@/services/plans'

/**
 * Draft ⇄ Active toggle on a plan card. Status is owned here (via `updatePlanMetaAction`) —
 * the editor no longer carries it, so a save from the editor can never overwrite a toggle
 * made from the list. Flips optimistically and reverts if the request fails.
 */
export function PlanStatusSwitch({ planId, status }: { planId: string; status: Plan['status'] }) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<Plan['status'] | null>(null)
  const [pending, setPending] = useState(false)
  const active = (optimistic ?? status) === 'active'

  async function toggle(checked: boolean) {
    if (pending) return
    const next: Plan['status'] = checked ? 'active' : 'draft'
    setOptimistic(next)
    setPending(true)
    try {
      const result = await updatePlanMetaAction(planId, { status: next })
      if (!result.ok) {
        setOptimistic(null)
        toast.error(result.error.message)
        return
      }
      router.refresh()
    } catch {
      setOptimistic(null)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span className={cn('font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
        {active ? 'Active' : 'Draft'}
      </span>
      <Switch
        checked={active}
        onCheckedChange={(checked) => void toggle(checked)}
        disabled={pending}
        aria-label="Plan status"
      />
    </div>
  )
}
