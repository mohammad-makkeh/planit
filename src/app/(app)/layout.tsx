import { requireCoachId } from '@/lib/session'
import { BottomNav } from '@/components/shell/bottom-nav'
import { Sidebar } from '@/components/shell/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCoachId() // defense in depth beyond middleware
  return (
    <div className="min-h-dvh md:pl-56">
      <Sidebar />
      <main className="pb-24 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  )
}
