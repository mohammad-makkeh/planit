import 'server-only'
import { join } from 'node:path'
import { Font } from '@react-pdf/renderer'

/**
 * Font faces for the generated PDF, registered once at module scope.
 *
 * react-pdf resolves `src` with Node's fs when it is a path rather than a URL, so these must
 * be absolute — `process.cwd()` is the project root both in `next dev` and inside a serverless
 * function. `next.config.ts` lists `src/pdf-fonts/**` in `outputFileTracingIncludes` so the
 * .ttf files actually ship with the two PDF routes; without that the trace would drop them
 * (nothing statically imports them) and every render would silently fall back to Helvetica.
 */
const FONT_DIR = join(process.cwd(), 'src/pdf-fonts')

/** Jockey One — the poster face: day titles and the workout table head. */
export const FONT_DISPLAY = 'JockeyOne'
/** Kelly Slab — the letterspaced kickers, labels and exercise numbers. */
export const FONT_LABEL = 'KellySlab'
/** Inter — everything else, in 400/500/600/700/800. */
export const FONT_BODY = 'Inter'

Font.register({ family: FONT_DISPLAY, src: join(FONT_DIR, 'JockeyOne.ttf') })
Font.register({ family: FONT_LABEL, src: join(FONT_DIR, 'KellySlab.ttf') })
Font.register({
  family: FONT_BODY,
  fonts: [
    { src: join(FONT_DIR, 'Inter-400.ttf'), fontWeight: 400 },
    { src: join(FONT_DIR, 'Inter-500.ttf'), fontWeight: 500 },
    { src: join(FONT_DIR, 'Inter-600.ttf'), fontWeight: 600 },
    { src: join(FONT_DIR, 'Inter-700.ttf'), fontWeight: 700 },
    { src: join(FONT_DIR, 'Inter-800.ttf'), fontWeight: 800 },
  ],
})

// Exercise names are proper nouns and gym jargon; hyphenating them mid-word reads as a typo.
// Returning the word untouched turns hyphenation off without disabling word wrapping.
Font.registerHyphenationCallback((word) => [word])
