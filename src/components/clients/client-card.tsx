import Link from 'next/link'
import { Blobatar } from '@blobatar/react'
import { Badge } from '@/components/ui/badge'
import { formatRelative } from '@/lib/format'
import type { ClientListItem } from '@/services/clients'

export function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40 active:bg-accent/60"
    >
      <div className="shrink-0">
        <Blobatar name={client.name} size={44} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{client.name}</p>
        <p className="truncate text-sm text-muted-foreground">{client.phone ?? 'No phone'}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant="secondary">
          {client.planCount} {client.planCount === 1 ? 'plan' : 'plans'}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatRelative(client.lastActivityAt)}</span>
      </div>
    </Link>
  )
}
