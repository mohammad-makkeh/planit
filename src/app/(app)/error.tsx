'use client'

import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Your data is safe — try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
