'use client'

import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DialogSheet } from '@/components/ui/dialog-sheet'
import {
  advancesWithoutRest, initialState, purgeStaleProgress, readMuted, readProgress, reduce, removeProgress,
  todayDate, todayKey, writeMuted, writeProgress, type GymAction, type GymState,
} from '@/lib/gym-mode'
import type { SharedRow, SharedSession } from '@/services/share'
import { MoveDetails } from '../move-details'
import { FinishScreen } from './finish-screen'
import { MoveListSheet } from './move-list-sheet'
import { MoveScreen } from './move-screen'
import { buzz, playChime, primeAudio } from './signals'
import { useRestClock } from './use-rest-clock'
import { useWakeLock } from './use-wake-lock'

/** How long the last tick's pop plays before a row with no rest moves on. */
const NO_REST_ADVANCE_MS = 400

const subscribeNothing = () => () => {}
/** True after hydration. The player body reads localStorage while initialising, which the server can't. */
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false)
}

/**
 * The full-screen workout player: a Base UI dialog in the app's `dark` token scope, on the
 * header band's near-black, carrying the coach's `--brand` (it portals out of the share view).
 * The body mounts per plan + day and only on the client.
 */
export function GymMode({
  open,
  slug,
  day,
  session,
  headline,
  planUpdatedAt,
  brand,
  onClose,
  onClosed,
  onFlexIt,
}: {
  open: boolean
  slug: string
  day: number
  session: SharedSession | undefined
  headline: string
  planUpdatedAt: number
  brand: string
  onClose: () => void
  onClosed: () => void
  onFlexIt: () => void
}) {
  const isClient = useIsClient()
  const showing = open && isClient && session !== undefined
  useWakeLock(showing)

  const theme = {
    '--brand': brand,
    '--background': '#0f0f0f',
    '--card': 'rgba(255,255,255,0.06)',
  } as CSSProperties

  return (
    <Dialog
      open={showing}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="dark inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 text-foreground ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,52rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1"
        style={theme}
      >
        {session && (
          <Player
            key={`${slug}:${day}:${planUpdatedAt}`}
            slug={slug}
            day={day}
            session={session}
            headline={headline}
            planUpdatedAt={planUpdatedAt}
            theme={theme}
            onClose={onClose}
            onFlexIt={onFlexIt}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Player({
  slug,
  day,
  session,
  headline,
  planUpdatedAt,
  theme,
  onClose,
  onFlexIt,
}: {
  slug: string
  day: number
  session: SharedSession
  headline: string
  planUpdatedAt: number
  theme: CSSProperties
  onClose: () => void
  onFlexIt: () => void
}) {
  const rows = session.rows
  // The key is fixed for this mount: a workout that crosses midnight keeps its progress.
  const [key] = useState(() => todayKey(slug, day, planUpdatedAt))
  const [state, dispatch] = useReducer(
    (current: GymState, action: GymAction) => reduce(current, action, rows),
    rows,
    (initialRows) => readProgress(key, initialRows) ?? initialState(initialRows),
  )
  const [muted, setMuted] = useState(readMuted)
  const [listOpen, setListOpen] = useState(false)
  const [details, setDetails] = useState<SharedRow | null>(null)
  const advanceTimer = useRef<number | null>(null)

  // Yesterday's progress for this plan is dropped once per opening; today's is written on every change.
  useEffect(() => {
    purgeStaleProgress(slug, todayDate())
  }, [slug])
  useEffect(() => {
    writeProgress(key, state)
  }, [key, state])
  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const remainingMs = useRestClock(state.rest?.endsAt ?? null, (now) => {
    dispatch({ type: 'rest-ended', now })
    buzz()
    if (!muted) playChime()
  })

  function toggleSet(move: number, set: number) {
    primeAudio()
    const now = Date.now()
    const action: GymAction = { type: 'toggle-set', move, set, now }
    const next = reduce(state, action, rows)
    dispatch(action)
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (advancesWithoutRest(next, move, rows)) {
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        dispatch({ type: 'advance', now: Date.now() })
      }, NO_REST_ADVANCE_MS)
    }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    writeMuted(next)
  }

  function done() {
    removeProgress(key)
    onClose()
  }

  function flexIt() {
    removeProgress(key)
    onFlexIt()
  }

  return (
    <>
      <DialogTitle className="sr-only">Gym mode: {session.label}</DialogTitle>
      {state.finished ? (
        <FinishScreen headline={headline} session={session} state={state} onDone={done} onFlexIt={flexIt} />
      ) : (
        <MoveScreen
          session={session}
          state={state}
          remainingMs={remainingMs}
          muted={muted}
          onToggleSet={toggleSet}
          onSkipRest={() => dispatch({ type: 'skip-rest', now: Date.now() })}
          onGoTo={(move) => dispatch({ type: 'go-to', move })}
          onFinish={() => dispatch({ type: 'finish', now: Date.now() })}
          onToggleMute={toggleMute}
          onClose={onClose}
          onOpenList={() => setListOpen(true)}
          onOpenDetails={setDetails}
        />
      )}
      <MoveListSheet
        open={listOpen}
        onOpenChange={setListOpen}
        session={session}
        state={state}
        onPick={(move) => {
          dispatch({ type: 'go-to', move })
          setListOpen(false)
        }}
        className="dark"
        style={theme}
      />
      <DialogSheet
        open={details !== null}
        onOpenChange={(next) => {
          if (!next) setDetails(null)
        }}
        title={details?.exercise.name ?? ''}
        className="dark"
        style={theme}
      >
        {details && <MoveDetails row={details} />}
      </DialogSheet>
    </>
  )
}
