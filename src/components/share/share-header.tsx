import type { SharedPlan } from '@/services/share'

export function ShareHeader({
  coach,
  client,
  planTitle,
}: {
  coach: SharedPlan['coach']
  client: SharedPlan['client']
  planTitle: string
}) {
  const coachMeta = [coach.title, coach.phone].filter(Boolean).join(' · ')

  return (
    <header className="space-y-6 px-4 pt-6 pb-2">
      <div className="flex items-center gap-3">
        {coach.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coach.logoUrl}
            alt=""
            className="size-10 shrink-0 rounded-full border object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{coach.name}</p>
          {coachMeta && <p className="truncate text-xs text-muted-foreground">{coachMeta}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {client.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{planTitle}</h1>
      </div>
    </header>
  )
}
