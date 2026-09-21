import { Users } from 'lucide-react'
import { ClientCard } from '@/components/clients/client-card'
import { ClientSearch } from '@/components/clients/client-search'
import { NewClientButton } from '@/components/clients/new-client-button'
import { EmptyState } from '@/components/shell/empty-state'
import { PageHeader } from '@/components/shell/page-header'
import { requireCoachId } from '@/lib/session'
import { listClients } from '@/services/clients'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const coachId = await requireCoachId()
  const { q } = await searchParams
  const items = await listClients(coachId, q)

  return (
    <>
      <PageHeader title="Clients" />
      <div className="sticky top-14 z-20 bg-background/95 px-4 py-2 backdrop-blur md:px-8">
        <ClientSearch />
      </div>
      <div className="space-y-4 p-4 md:p-8">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8 text-muted-foreground" />}
            title={q ? 'No clients match your search' : 'No clients yet'}
            description={q ? 'Try a different name or phone.' : 'Add your first client to get started.'}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </div>
      <NewClientButton />
    </>
  )
}
