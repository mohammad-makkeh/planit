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

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-xs font-medium',
              isActive(pathname, href) ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('size-5', isActive(pathname, href) && 'text-brand')} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
