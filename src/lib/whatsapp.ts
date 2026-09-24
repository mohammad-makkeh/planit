/**
 * Numbers without a country code are taken as Lebanese: Planit's coaches and their clients are
 * in Lebanon and store numbers the local way ("70 123 456", "03 123 456").
 */
const DEFAULT_COUNTRY_CODE = '961'

/**
 * A stored phone number → the digits wa.me wants (country code, no `+`, no leading zeros), or
 * null when there aren't enough digits to be a number. International numbers (`+…` or `00…`)
 * keep their own country code; local ones get the default and lose their trunk `0`.
 */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  let number: string
  if (trimmed.startsWith('+')) number = digits
  else if (digits.startsWith('00')) number = digits.slice(2)
  else if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > 8) number = digits
  else number = DEFAULT_COUNTRY_CODE + digits.replace(/^0+/, '')
  return number.length >= 8 && number.length <= 15 ? number : null
}

/** Opens a chat with `number` (from `whatsappNumber`), the message typed in and ready to send. */
export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/** "Hey Ali, here's your plan: <link>" — first name only, the way a coach texts a client. */
export function planMessage(clientName: string, url: string): string {
  const firstName = clientName.trim().split(/\s+/)[0]
  return firstName ? `Hey ${firstName}, here's your plan: ${url}` : `Here's your plan: ${url}`
}
