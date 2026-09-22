import { Link2Off } from 'lucide-react'

/** Rendered when a share slug doesn't resolve to a live plan — no app chrome, no login link. */
export function LinkInactive() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Link2Off className="size-5 text-muted-foreground" />
        </div>
        <p className="font-semibold">This link is no longer active.</p>
        <p className="text-sm text-muted-foreground">Ask your coach for a new one.</p>
      </div>
    </main>
  )
}
