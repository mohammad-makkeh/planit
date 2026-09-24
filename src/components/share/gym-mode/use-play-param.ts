'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

const PARAM = 'play'

/**
 * The player's open state lives in the URL as `?play=<dayIndex>`, so the browser back button
 * (and an iOS edge swipe) closes the player instead of leaving the page. Next integrates
 * `history.pushState` / `replaceState` with its router, so `useSearchParams` follows them.
 *
 * `open` pushes an entry; `close` goes back to consume it. When the page was *loaded* with the
 * param (a reload, a pasted link) nothing was pushed, so `close` strips the param in place —
 * going back would leave the site. An invalid value is stripped on load and never opens anything.
 */
export function usePlayParam(isPlayable: (day: number) => boolean): {
  playing: number | null
  open: (day: number) => void
  close: () => void
} {
  const searchParams = useSearchParams()
  const raw = searchParams.get(PARAM)
  const parsed = raw !== null && /^\d{1,2}$/.test(raw) ? Number(raw) : null
  const playing = parsed !== null && isPlayable(parsed) ? parsed : null
  const pushed = useRef(false)

  useEffect(() => {
    if (raw === null || playing !== null) return
    const url = new URL(window.location.href)
    url.searchParams.delete(PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [raw, playing])

  const open = useCallback((day: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM, String(day))
    window.history.pushState(null, '', `${url.pathname}${url.search}`)
    pushed.current = true
  }, [])

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      window.history.back()
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete(PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  return { playing, open, close }
}
