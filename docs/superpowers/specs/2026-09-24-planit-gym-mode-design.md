# Planit — Gym Mode on the share page

**Date:** 2026-09-24
**Status:** Approved (brainstorm with the owner, 2026-09-24; mockup direction "B — Focus" chosen)
**Parents:** `2026-09-22-planit-share-and-print-design.md` (share page), `AGENTS.md` (binding
rules, non-goals). Backlog item 4.

## Why

A client opens their coach's link at the gym and today reads a page. Gym Mode lets them *run*
the day from the phone: one move at a time, tick sets with a thumb, glance at a rest countdown,
always see what's next. The coach's branded plan becomes the thing followed at the bench, which
is what makes the coach look good. It costs nothing to run and stores nothing on the server.

Someone who never taps Start sees the share page exactly as it is today, plus one small pill.

## Decisions made with the owner

| Question | Decision |
|---|---|
| What the player walks through | **Moves only.** Warm-up and cardio stay on the page (revisit later). |
| Rest-end signal | **Vibrate where supported + a short chime**, with one mute icon in the top bar. iOS Safari has no Vibration API, so the chime is what iPhone users get. |
| Look and layout | **"Focus"**: full-screen, on the header band's near-black, white type, the coach's colour as the only accent. The figure card doubles as the rest countdown so nothing on screen moves when a set is ticked. |
| Where it lives | **Same-page overlay whose open state is mirrored in the URL**, so the back button closes the player instead of leaving the page. |
| Everything else | The design below, as presented, approved without changes. |

## Scope

In: the Start pill, the player (move screen, set ticks, rest timer, next-up row, move list,
finish screen), chime + vibration + mute, wake lock, same-day progress memory on the phone,
back-button integration, desktop presentation.

Out (on purpose): warm-up and cardio steps, swipe gestures between moves, editing reps or
weights, any history beyond today, anything stored server-side, accounts, logging (see the
non-goals in `AGENTS.md`).

No server, schema or migration changes. `SharedRow` / `SharedSession` already carry everything
the player needs.

## Entry point (share page)

- In `ShareSession`, the Workout section header becomes a row: the existing `WORKOUT` kicker on
  the left, a brand-tinted pill on the right styled exactly like Flex it (`h-9 rounded-full
  bg-brand/10 text-brand`, `Play` icon): **`Start`**.
- When the phone holds progress for this day today (see *Memory*), the pill reads
  **`Continue · 2 of 4`** (the move the client is on / total, the same numbers as the player's
  counter). Read in an effect after mount, never during render, so server and client HTML match.
- The pill renders only when the day has at least one row.
- Tapping it opens the player for the selected day.

## The player

A full-screen Base UI `Dialog` (the pattern `MuscleSummaryDialog` already uses), rendered inside
the app's existing **`dark` token scope** with the page background overridden to the header
band's `#0f0f0f` and the coach's `--brand` set on the popup (it portals out of the share view,
like `StorySheet`). Every primitive inside flips to dark through the tokens; no new colour
styles.

### Move screen (one move at a time)

Top to bottom, at 390×844 without scrolling:

1. **Top bar.** Left: close (`X`, `size-10` round, `bg-muted`). Centre: the day label as a
   kicker (`PUSH DAY`) over **`1 / 4`** (current move / total) — the counter is a button that
   opens the move list. Right: mute toggle (`Volume2` / `VolumeX`, `size-10` round).
2. **Progress.** One thin segment per move (`h-1 rounded-full`, `gap-1.5`). A finished move's
   segment is full brand; the current one fills by `done sets / total sets`; the rest are
   `bg-border`.
3. **Hero card** (`rounded-3xl border bg-card`, fixed height `h-[min(36dvh,20rem)]`). Shows
   the move's figure: `MuscleMap single` (front or back, focus-cropped, the same rules as
   `MoveThumbnail`) filling the card; a move with no muscle targets shows its equipment icon
   large, as the lightbox does. Tapping the card or the name opens **move details**. While
   resting, the same card becomes the **timer** (below) and only the name opens details.
4. **Info.** Name (`text-2xl font-extrabold tracking-tight`, 2 lines max, balanced). Chips row:
   equipment (icon + name) and movement type, the share card's chips. Numbers row: big
   **`4 × 10`** (sets × reps; `4 sets` when reps are missing; `10 reps` when sets are missing;
   omitted when both are), then a muted line joining what exists with ` · `: `90 s rest`,
   `75% 1RM`, `2/1/1`. The row note, if any, in muted text under it (2 lines, clamped).
5. **Set ticks.** One circle per set (`size-15`, i.e. 60px, `rounded-full border-2`), centred,
   wrapping onto a second row past 5. Empty: `border-border`, the set number inside in muted
   text. The **first empty circle** is the "now" circle: `border-brand text-brand`. Done:
   `bg-brand border-brand`, white `Check`. Tapping any circle toggles it. A tap that marks a set
   done gives a quick scale pop and, when the row has `rest > 0`, starts the rest timer. A row
   with `sets` null gets a single circle labelled with a check ("Done").
   Buttons carry `aria-pressed` and `aria-label="Set 3, done|not done"`.
6. **Next up row** (pinned above the safe area, `rounded-2xl border bg-card p-3`): the next
   move's `MoveThumbnail` (`size-11`), `NEXT UP` kicker, its name, chevron. Tapping it jumps to
   that move. On the **last move** the row becomes a brand-filled **`Finish workout`** button.

### Rest timer

- Starts when a set is ticked on a row with `rest > 0`. The state stores an **end timestamp**
  (`endsAt = now + rest × 1000`); the display computes the remaining time on each animation
  frame, so backgrounding the tab (music app, lock screen) never drifts it.
- Rendered inside the hero card: the figure fades to ~12% behind a stack of `REST` kicker,
  the remaining time as `m:ss` (`text-7xl font-extrabold tabular-nums tracking-tighter`), a
  thin brand track shrinking with the time, and a **`Skip`** pill (`h-10`, `SkipForward` icon).
  `role="timer"`, not live (no per-second announcements).
- **On end:** buzz + chime (unless muted; see *Signals*), the hero flips back to the figure.
  If every set of the current move is done, the player **advances to the next move** by itself;
  on the last move it goes to the finish screen.
- **Skip** ends the rest immediately and silently, with the same advance rule.
- Ticking another set during a rest replaces the running rest. Un-ticking the set whose rest is
  running cancels that rest. Jumping to another move while resting does not stop the rest: it
  keeps counting in that move's hero (the client walked to the next station mid-rest), and its
  end applies the advance rule to the move the rest belongs to only if that move is on screen.
- A row with `rest` null or `0`: ticking marks the set; ticking the **last** set advances after
  the tick animation (~400 ms), no timer.
- If the rest ended while the tab was hidden, the end handling (signal, advance) runs **once**
  when the tab becomes visible again.

### Move list

The `1 / 4` counter opens a `DialogSheet` (a nested Base UI dialog — the player is a Base UI
dialog, and a vaul sheet over one fights it for focus, see `AGENTS.md` §7) titled with the day
label: each move as a row with `MoveThumbnail`, name, `2 / 4 sets` (or a brand check when
complete), the current move marked. Tapping a row jumps to it and closes the sheet. This is how
a client does the free machine first when the bench is taken.

### Move details

The existing lightbox content (figure, chips, muscles, `Watch tutorial`) is extracted into a
`MoveDetails` component. The share page keeps rendering it in the vaul `BottomSheet`
(`MoveLightbox`, unchanged behaviour); the player renders the same component in a `DialogSheet`.
`DialogSheet` gains an optional `className` so the player can pass the `dark` scope and
`--brand` into it (it portals to `body`).

### Finish screen

Replaces the move screen after the last move: the day's figure (`MuscleMap` of
`shadesForRows(session.rows)`, both sides, large), **`Workout done`**, a summary line
`Push day · 4 moves · 13 sets · 48 min` (day headline from `dayFocus`, row count, **ticked**
sets, minutes from the first ticked set to the finish, rounded, at least 1 when anything was ticked), then two buttons: **`Flex it`** (brand) and
**`Done`** (outline). Both clear the saved progress and close the player; Flex it additionally
opens the share page's existing `StorySheet` for this day. The story sheet is vaul and opens
*after* the dialog has closed, so the two never overlap. The finish screen can also be reached
from the last move's `Finish workout` button with sets left undone; the summary counts what was
ticked.

### Desktop

Below `sm`: full-screen, `h-dvh`, safe-area padding top and bottom. From `sm` up: a centred
panel over the dimmed backdrop, phone-proportioned (`max-w-md`, `h-[min(90dvh,52rem)]`,
`rounded-3xl`), same content, same behaviour.

### Closing

The `X`, the back button, an iOS edge swipe or `Escape` close the player. Closing **keeps** the
saved progress (the Start pill turns into Continue); only Done / Flex it on the finish screen
clear it. No confirm dialog: nothing is lost by closing.

## URL and history

- Opening pushes a history entry with `?play=<dayIndex>` (`window.history.pushState`, which
  Next 16 integrates with its router — read `node_modules/next/dist/docs/` for the current
  contract before implementing). Closing from inside the player calls `history.back()` so the
  entry is consumed; the browser back button / edge swipe fires `popstate`, which closes the
  player. Either way the share page underneath is untouched, scroll position included.
- On load with a valid `?play=<n>` (an existing day index with rows) the player opens for that
  day, restoring progress if the phone has any, and the day chips select that day. No entry was
  pushed in this case, so closing strips the param with `replaceState` instead of going back
  (going back would leave the site). An invalid value is ignored and stripped.
- The param never affects server rendering (the page is `force-dynamic` and reads no search
  params); metadata is unchanged.

## Memory (on the phone only)

- Key: `planit:gym:<slug>:<dayIndex>:<YYYY-MM-DD local>:<planUpdatedAtMs>` in `localStorage`,
  value: the serialised player state below (JSON). Written on every state change; read when
  the player opens and when the Start pill mounts.
- The plan's `updatedAt` in the key means a coach saving the plan mid-workout resets progress
  instead of pointing ticks at the wrong rows. The local date means tomorrow starts clean and
  a reopened WhatsApp link the same day **resumes**.
- On open, other `planit:gym:` keys for this slug that don't match today's date are removed, so
  storage never accumulates.
- Mute: `planit:gym:muted` = `"1"`.
- Reads and writes are wrapped in try/catch: private mode or blocked storage degrades to
  "progress lives until the tab closes", nothing breaks.

## State model (pure, in `src/lib/gym-mode.ts`)

```ts
type GymState = {
  startedAt: number | null     // epoch ms of the first ticked set (for the finish summary)
  finishedAt: number | null    // epoch ms when the finish screen was reached
  move: number                 // index of the move on screen
  ticks: boolean[][]           // ticks[move][set]; a row with sets null has one entry
  rest: { move: number; set: number; endsAt: number } | null
  finished: boolean
}

type GymAction =
  | { type: 'toggle-set'; move: number; set: number; now: number }   // tick / untick
  | { type: 'skip-rest' }
  | { type: 'rest-ended' }
  | { type: 'go-to'; move: number }
  | { type: 'finish' }
```

Pure helpers beside it: `initialState(rows, now)`, `reduce(state, action, rows)`, `storageKey(slug,
day, date, planUpdatedAt)`, `serialize` / `deserialize` (validates shape and row counts; a
mismatch returns null → fresh state), `formatCountdown(ms)` → `m:ss`, `setsDone(state, move)`,
`progressLabel(state, rows)` → `"2 of 4"`, `summary(state, rows, now)` → `{ moves, sets, minutes }`.
The advance-after-rest rule and the no-rest advance live in the reducer so the component is thin.

## Signals and device APIs

- **Chime:** Web Audio, no asset. An `AudioContext` is created lazily on the first set tick (the
  user gesture iOS requires) and resumed if suspended. The chime is two short tones (≈ 880 Hz
  then ≈ 1320 Hz, ~120 ms each with a soft gain envelope, ~350 ms total). Muted → no chime.
- **Vibration:** `navigator.vibrate?.([200, 100, 200])` on rest end. Mute does **not** stop the
  buzz: it disturbs nobody and the mute icon is a speaker.
- **Wake lock:** `navigator.wakeLock?.request('screen')` when the player opens; re-requested on
  `visibilitychange` → visible (the browser releases it when the tab hides); released on close.
  Unsupported or refused → ignored.
- **Timer loop:** `requestAnimationFrame` while a rest is running and the tab is visible; the
  remaining time is `endsAt - Date.now()`. Nothing runs when there's no rest.

## Components and files

```
src/lib/gym-mode.ts                         pure state, storage key, formatting, summary
src/components/share/gym-mode/
  gym-mode.tsx                              the dialog shell: dark scope, --brand, URL mirroring,
                                            wake lock, persistence, reducer wiring, screen switch
  move-screen.tsx                           top bar, progress, hero (figure | timer), info, ticks, next up
  set-ticks.tsx                             the circles
  rest-timer.tsx                            countdown inside the hero, Skip
  move-list-sheet.tsx                       DialogSheet with the day's moves
  finish-screen.tsx                         summary + Flex it + Done
  use-wake-lock.ts, use-rest-clock.ts, use-play-param.ts, signals.ts
src/components/share/move-details.tsx       extracted from move-lightbox.tsx (which now wraps it)
src/components/share/share-session.tsx      Workout header row with the Start / Continue pill
src/components/share/share-view.tsx         owns `playing` (day index | null), renders GymMode,
                                            opens StorySheet after Flex it
src/components/ui/dialog-sheet.tsx          optional className / style props
```

Dependencies point the same way as today (components → lib; no `db/`, no services beyond types).
Icons from lucide: `Play`, `X`, `Volume2`, `VolumeX`, `Check`, `SkipForward`, `ChevronRight`,
`Flame`.

## UI rules that apply (from `AGENTS.md`)

Tap targets ≥ 40px (ticks are 60px, the top-bar buttons `size-10`, Skip `h-10`); safe-area
insets top and bottom; no horizontal overflow at 390; consistent `px-5` gutters inside the
player; sentence-case copy; `render` prop, never `asChild`; nested sheets over the dialog are
`DialogSheet`, never vaul; `useId()` isn't needed (no dnd); the hero has explicit dimensions so
the SVG never collapses.

## Verification (before "done")

1. `npx tsc --noEmit`, `npx eslint src`, `npx next build` (then restart the dev server).
2. Browser, on the test fixture `/p/ljFXxhEJ_1TM` (owner's test account), at **390×844** and a
   desktop width, judged as a designer:
   - Share page: Start pill placement and size; page otherwise unchanged; no pill on a day with
     no moves.
   - Player: every element of the move screen fits without scrolling at 390×844; dark scope
     applied everywhere including the list sheet and move details; brand colour is the coach's.
   - Tick → pop + rest starts; Skip; rest end flips back; last set's rest end auto-advances;
     un-tick cancels a running rest; a row with no rest advances after the last tick; a row with
     no sets shows one circle; a move without muscles shows the equipment icon.
   - `1 / 4` opens the list; jumping works; Next up jumps; last move shows Finish workout.
   - Finish screen numbers; Done clears progress (Start pill back to `Start`); Flex it closes
     the player and opens the story sheet.
   - Close and reopen → `Continue · n of m` and the same ticks; reload with `?play=` reopens.
   - Back button / edge swipe closes the player and leaves the page in place.
   - Mute toggle persists across reopen. Chime audible on a real phone; buzz on Android.
   - Screen stays awake on a real phone with the player open.
3. Wake lock, vibration and audio need a real device for a final pass; the emulated checks
   cover layout and state.

## Not in this spec

Anything the owner brings after seeing the first working version ("it does need changes that
we can discuss") is handled as follow-ups against the built player, not by widening this spec.
