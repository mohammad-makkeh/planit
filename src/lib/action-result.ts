import type { ZodError } from 'zod'

export type ActionErrorCode = 'validation' | 'not_found' | 'unauthorized' | 'conflict' | 'unknown'

export type ActionError = {
  code: ActionErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function err(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message, fieldErrors } }
}

export function fromZod(error: ZodError): { ok: false; error: ActionError } {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return err('validation', 'Please fix the highlighted fields.', fieldErrors)
}
