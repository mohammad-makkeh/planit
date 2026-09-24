'use client'

import { useSyncExternalStore } from 'react'
import { progressLabel, readProgress, subscribeProgress, todayKey, type GymRow } from '@/lib/gym-mode'

const serverSnapshot = () => null

/**
 * "2 of 4" when this phone holds progress for the day today, else null — for the Start pill.
 * An external-store read rather than an effect: the server renders `Start`, the client swaps
 * in `Continue` on hydration without a mismatch, and every progress write re-reads it.
 */
export function useStoredProgress(
  slug: string,
  day: number,
  planUpdatedAt: number,
  rows: GymRow[],
): string | null {
  return useSyncExternalStore(
    subscribeProgress,
    () => {
      const saved = readProgress(todayKey(slug, day, planUpdatedAt), rows)
      return saved ? progressLabel(saved) : null
    },
    serverSnapshot,
  )
}
