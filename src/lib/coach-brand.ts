import 'server-only'

/** The app's brand orange — what a coach gets until they pick their own colour. */
export const DEFAULT_BRAND = '#FE2E00'

/**
 * The coach's colour as a literal hex, or the default. Server renderers (pdfkit, Satori) take
 * the value verbatim, and anything that isn't a plain hex colour would throw mid-render.
 */
export function safeBrand(value: string | null): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : DEFAULT_BRAND
}

export type LogoImage = { data: Buffer; format: 'png' | 'jpg' }

/**
 * The coach's logo bytes, for the server-rendered PDF and link preview. Both only decode PNG
 * and JPEG, and a single unreachable or exotic logo would otherwise fail the whole render, so a
 * bad logo degrades to "no logo" instead of a 500. The timeout keeps a slow/hanging logo host
 * from stalling the render until the platform limit — the abort it raises lands in the same
 * catch as any other fetch failure.
 */
export async function loadLogo(url: string | null): Promise<LogoImage | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const data = Buffer.from(await response.arrayBuffer())
    if (data.length > 4 && data[0] === 0x89 && data[1] === 0x50) return { data, format: 'png' }
    if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8) return { data, format: 'jpg' }
    return null
  } catch {
    return null
  }
}
