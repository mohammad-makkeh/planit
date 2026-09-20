import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientActionsMenu } from '@/components/clients/client-actions-menu'
import { PlanList } from '@/components/clients/plan-list'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { requireCoachId } from '@/lib/session'
import { getClient } from '@/services/clients'
import { listPlansForClient } from '@/services/plans'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoachId()
  const { id } = await params
  const client = await getClient(coachId, id)
  if (!client) notFound()
  const clientPlans = await listPlansForClient(coachId, id)

  const facts = [
    client.age !== null ? `${client.age} yrs` : null,
    client.weightKg !== null ? `${client.weightKg} kg` : null,
    client.heightCm !== null ? `${client.heightCm} cm` : null,
    client.phone,
  ].filter((f): f is string => f !== null)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-2 py-2 backdrop-blur md:px-6">
        <Link href="/" className="flex items-center gap-1 p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Clients
        </Link>
        <ClientActionsMenu client={client} />
      </header>
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
              {initials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{client.name}</h1>
            {facts.length > 0 && (
              <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>
            )}
          </div>
        </div>
        {client.notes && (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{client.notes}</p>
        )}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Plans</h2>
          <PlanList plans={clientPlans} />
        </section>
      </div>
    </>
  )
}
