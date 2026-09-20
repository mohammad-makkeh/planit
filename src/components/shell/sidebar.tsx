'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Clients', icon: Users },
  { href: '/library', label: 'Library', icon: Dumbbell },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/clients')
  return pathname.startsWith(href)
}

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r bg-background md:flex">
      <div className="px-6 py-6 text-2xl font-bold tracking-tight">
        Plan<span className="text-brand">it</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(pathname, href)
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            <Icon className={cn('size-4', isActive(pathname, href) && 'text-brand')} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
