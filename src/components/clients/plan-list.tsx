import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { PlanCardMenu } from '@/components/plans/plan-card-menu'
import type { PickerClient } from '@/components/plans/client-picker-sheet'
import { PlanStatusSwitch } from '@/components/plans/plan-status-switch'
import { formatDate } from '@/lib/format'
import type { Plan } from '@/services/plans'

export function PlanList({
  plans,
  client,
  clients,
}: {
  plans: Plan[]
  client: { id: string; name: string; phone: string | null }
  clients: PickerClient[]
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8 text-muted-foreground" />}
        title="No plans yet"
        description="Create the first plan with the button below."
      />
    )
  }
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-4">
          <Link href={`/clients/${client.id}/plans/${plan.id}`} className="min-w-0 flex-1 py-2">
            <p className="truncate font-semibold">{plan.title}</p>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)} · Updated {formatDate(plan.updatedAt)}
            </p>
          </Link>
          <PlanStatusSwitch planId={plan.id} status={plan.status} />
          <PlanCardMenu
            plan={{ id: plan.id, title: plan.title, status: plan.status, shareSlug: plan.shareSlug }}
            client={client}
            clients={clients}
          />
        </div>
      ))}
    </div>
  )
}
