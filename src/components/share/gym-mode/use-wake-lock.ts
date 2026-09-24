'use client'

import { useEffect } from 'react'

/**
 * Keeps the screen on while `active`. The browser drops a wake lock whenever the tab is hidden,
 * so it is requested again each time the tab comes back. Unsupported or refused → nothing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) void next.release()
        else sentinel = next
      } catch {
        // Low battery mode or an unsupported platform: the screen dims as usual.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active])
}
