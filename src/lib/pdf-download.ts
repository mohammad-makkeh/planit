const FALLBACK_FILENAME = 'workout-plan.pdf'

export type PdfDownloadResult = { ok: true } | { ok: false; message: string }

/**
 * Pulls the filename out of a `content-disposition: attachment; filename="…"` header. Falls
 * back to a generic name if the header is missing or doesn't match the shape the PDF routes
 * always send.
 */
function filenameFromContentDisposition(header: string | null): string {
  if (!header) return FALLBACK_FILENAME
  const match = /filename="?([^";]+)"?/i.exec(header)
  if (!match) return FALLBACK_FILENAME
  return match[1] || FALLBACK_FILENAME
}

/**
 * Downloads a PDF from a same-origin route via `fetch` (so the session cookie rides along)
 * and saves it through a blob object URL, rather than navigating there directly. Keeping the
 * download owned by the current page — instead of a `window.open` tab or a plain `<a href>` —
 * means the browser's normal download UI (download bar / mobile notification) shows up where
 * the user is, and callers can show loading/error feedback for the multi-second server render.
 */
export async function downloadPdf(url: string): Promise<PdfDownloadResult> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return { ok: false, message: 'Could not build the PDF — please try again.' }
  }

  if (!response.ok) {
    return { ok: false, message: 'Could not build the PDF — please try again.' }
  }

  try {
    const filename = filenameFromContentDisposition(response.headers.get('content-disposition'))
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke on a short delay, not immediately — revoking synchronously can cancel the
    // download in some browsers before it's picked the object URL up.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not build the PDF — please try again.' }
  }
}
