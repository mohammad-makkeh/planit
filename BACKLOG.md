# Backlog

Worked top to bottom, one item at a time. Everything here must stay zero-cost to run.

## 1. Send to the client on WhatsApp + branded link preview

- **Send on WhatsApp** in the share sheet: opens the client's chat (their stored phone number)
  with a pre-filled message, e.g. "Hey Ali, here's your plan: <link>". Falls back to a plain
  share / copy when the client has no phone number.
- **Link preview (Open Graph)** for `/p/[slug]`: title "Ali — 5-Day Split", coach name as the
  description, and a generated preview image with the coach's logo and brand colour, the
  plan title, and the week's body figure. Replaces today's bare "Workout Plan" title.
- Free: `wa.me` chat links + Next.js image generation on Vercel.

## 2. Smart row defaults in the editor

- A move added to a day starts with that day's last row's sets, reps and rest instead of
  empty fields. The first move in an empty day stays empty.
- Applies everywhere rows are added (Add move, swap keeps its own values, the Week view's
  muscle-gap suggestions).
- No "apply to all".

## 3. Branded share cards for Instagram Stories

- "Share my day" on the share page: a story-sized image with the coach's logo and brand
  colour, the day's shaded muscle figure, and a line like "Push Day · 13 sets · 4 moves".
- Opens the phone's native share sheet (Web Share API) with the image; download as a
  fallback.
- One image route rendered server-side; the body figure is already polygons it can draw.

## 4. Gym Mode on the share page

- "Start workout" opens a full-screen player, one move at a time: body figure, sets × reps,
  big tappable set checkmarks.
- After a set, an automatic rest countdown from the plan's rest seconds, with vibration.
- Keeps the screen awake (Wake Lock API) and always shows "Next up".
- No login and no logging: set ticks live only on the phone for that session.
