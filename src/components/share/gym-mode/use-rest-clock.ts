'use client'

import { useEffect, useRef, useState } from 'react'

type Snapshot = { endsAt: number; ms: number }

/**
 * The remaining rest, recomputed from the end timestamp on each animation frame so a tab that
 * was backgrounded (music app, lock screen) never drifts. Returns whole seconds as ms — one
 * state update per second, not sixty. `onEnd` fires exactly once when the rest runs out; if it
 * ran out while the tab was hidden, it fires when the tab is visible again. 0 when no rest runs,
 * and 0 for a rest whose first frame hasn't run yet — the caller shows the full rest for that,
 * never the previous rest's last value.
 */
export function useRestClock(endsAt: number | null, onEnd: (now: number) => void): number {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    if (endsAt === null) return
    let frame = 0
    let ended = false

    const tick = () => {
      const now = Date.now()
      const left = endsAt - now
      if (left <= 0) {
        if (!ended) {
          ended = true
          setSnapshot({ endsAt, ms: 0 })
          onEndRef.current(now)
        }
        return
      }
      setSnapshot((current) => {
        const ms = Math.ceil(left / 1000) * 1000
        return current?.endsAt === endsAt && current.ms === ms ? current : { endsAt, ms }
      })
      frame = requestAnimationFrame(tick)
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [endsAt])

  // A snapshot belongs to one rest: a new rest reads 0 until its own first frame lands.
  return endsAt !== null && snapshot?.endsAt === endsAt ? snapshot.ms : 0
}
