import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-8">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  )
}
