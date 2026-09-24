/**
 * The rest-end signals. The chime is synthesised with Web Audio (no asset, no network): two
 * short rising tones. iOS only lets a page make sound after a user gesture created the audio
 * context, so `primeAudio` is called from every set tick and the chime just plays later.
 * The buzz is the Vibration API, which iOS Safari doesn't have — that's why the chime exists.
 */

let context: AudioContext | null = null

/** Call from a user gesture (a set tick). Safe to call repeatedly. */
export function primeAudio(): void {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  } catch {
    context = null
  }
}

/** Two short rising tones, ~350 ms. Silent until `primeAudio` has run from a gesture. */
export function playChime(): void {
  if (!context) return
  try {
    const t0 = context.currentTime
    for (const [frequency, at] of [
      [880, 0],
      [1320, 0.14],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, t0 + at)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(t0 + at)
      oscillator.stop(t0 + at + 0.2)
    }
  } catch {
    // An interrupted context; the buzz still fires.
  }
}

export function buzz(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Not supported: nothing to do.
  }
}
