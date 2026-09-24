'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { readEnabled, subscribeProgress, writeEnabled } from '@/lib/gym-mode'

export const ENABLE_PARAM = 'experimental_start'

const serverSnapshot = () => false

/**
 * Gym Mode's rollout gate. Hidden until this phone opens the share link with
 * `?experimental_start=1` once; that visit remembers the switch in localStorage, and from then
 * on the feature shows without the flag. The server can't see the stored switch, so it renders
 * without the pill and the client adds it after hydration — an external-store read, so there is
 * no markup mismatch.
 */
export function useGymEnabled(): boolean {
  const flagged = useSearchParams().get(ENABLE_PARAM) === '1'
  const stored = useSyncExternalStore(subscribeProgress, readEnabled, serverSnapshot)

  useEffect(() => {
    if (flagged && !stored) writeEnabled()
  }, [flagged, stored])

  return flagged || stored
}
