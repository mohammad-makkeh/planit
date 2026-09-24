'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The remaining rest, recomputed from the end timestamp on each animation frame so a tab that
 * was backgrounded (music app, lock screen) never drifts. Returns whole seconds as ms — one
 * state update per second, not sixty. `onEnd` fires exactly once when the rest runs out; if it
 * ran out while the tab was hidden, it fires when the tab is visible again. 0 when no rest runs.
 */
export function useRestClock(endsAt: number | null, onEnd: (now: number) => void): number {
  const [remaining, setRemaining] = useState(0)
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
          setRemaining(0)
          onEndRef.current(now)
        }
        return
      }
      setRemaining(Math.ceil(left / 1000) * 1000)
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

  return endsAt === null ? 0 : remaining
}
