import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { PlanCardMenu } from '@/components/plans/plan-card-menu'
import type { PickerClient } from '@/components/plans/client-picker-dialog'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { Plan } from '@/services/plans'

const STATUS_STYLES: Record<Plan['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-brand/10 text-brand',
  completed: 'bg-secondary text-secondary-foreground',
}

export function PlanList({
  plans,
  clients,
  clientId,
}: {
  plans: Plan[]
  clients: PickerClient[]
  clientId: string
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
          <Link href={`/clients/${clientId}/plans/${plan.id}`} className="min-w-0 flex-1 py-2">
            <p className="truncate font-semibold">{plan.title}</p>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)} · Updated {formatDate(plan.updatedAt)}
            </p>
          </Link>
          <Badge className={STATUS_STYLES[plan.status]}>{plan.status}</Badge>
          <PlanCardMenu
            plan={{ id: plan.id, title: plan.title, status: plan.status, shareSlug: plan.shareSlug }}
            clients={clients}
            currentClientId={clientId}
          />
        </div>
      ))}
    </div>
  )
}
