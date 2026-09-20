import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shell/empty-state'
import { formatDate } from '@/lib/format'
import type { Plan } from '@/services/plans'

const STATUS_STYLES: Record<Plan['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-brand/10 text-brand',
  completed: 'bg-secondary text-secondary-foreground',
}

export function PlanList({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8 text-muted-foreground" />}
        title="No plans yet"
        description="Plan creation arrives with the plan editor module."
      />
    )
  }
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{plan.title}</p>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)} · Updated {formatDate(plan.updatedAt)}
            </p>
          </div>
          <Badge className={STATUS_STYLES[plan.status]}>{plan.status}</Badge>
        </div>
      ))}
    </div>
  )
}
