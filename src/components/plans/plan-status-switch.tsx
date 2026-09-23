'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePlanMetaAction } from '@/actions/plan-editor'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { Plan } from '@/services/plans'

/**
 * Draft ⇄ Active toggle on a plan card. Status is owned here (via `updatePlanMetaAction`) —
 * the editor no longer carries it, so a save from the editor can never overwrite a toggle
 * made from the list. Flips instantly and never locks while a request is in flight; rapid
 * toggles are fine because server actions run in order and only the latest toggle's outcome
 * (success → refresh, failure → revert to the server value) is applied.
 */
export function PlanStatusSwitch({ planId, status }: { planId: string; status: Plan['status'] }) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<Plan['status'] | null>(null)
  const latestRequest = useRef(0)
  // Once the refreshed server value catches up, it becomes the source of truth again.
  if (optimistic !== null && optimistic === status) setOptimistic(null)
  const active = (optimistic ?? status) === 'active'

  async function toggle(checked: boolean) {
    const next: Plan['status'] = checked ? 'active' : 'draft'
    setOptimistic(next)
    const request = ++latestRequest.current
    try {
      const result = await updatePlanMetaAction(planId, { status: next })
      if (request !== latestRequest.current) return
      if (!result.ok) {
        setOptimistic(null)
        toast.error(result.error.message)
        return
      }
      router.refresh()
    } catch {
      if (request !== latestRequest.current) return
      setOptimistic(null)
      toast.error('Something went wrong. Please try again.')
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
        aria-label="Plan status"
      />
    </div>
  )
}
