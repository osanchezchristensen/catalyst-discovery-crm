import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Electron wraps IPC errors as "Error invoking remote method 'x': Error: msg"; keep only msg. */
export function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** After a failed submit, move focus to the first invalid field (once React has rendered the errors). */
export function focusFirstError(form: HTMLFormElement): void {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
