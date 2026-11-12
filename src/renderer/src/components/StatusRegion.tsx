import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'
import type { StatusTone } from '../../../shared/api'

/** `action` (e.g. Undo) keeps the message up until it is used or dismissed, so nobody is rushed. */
export type Status = { tone: StatusTone; message: string; key: number; action?: { label: string; run: () => void } }

/** One polite live region for success and error messages. Status is icon + word, never color alone. */
export function StatusRegion({ status, onDismiss }: { status: Status | null; onDismiss: () => void }) {
  useEffect(() => {
    if (status?.tone !== 'success' || status.action) return
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [status, onDismiss])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-6 bottom-6 z-50 max-w-md">
      {status && (
        <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
          {status.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          )}
          <p className="flex-1 break-words">
            <span className="font-semibold">{status.tone === 'success' ? 'Done: ' : 'Problem: '}</span>
            {status.message}
          </p>
          {status.action && (
            <button
              type="button"
              onClick={() => {
                status.action!.run()
                onDismiss()
              }}
              className="rounded-sm px-1 font-semibold text-primary underline underline-offset-2 hover:no-underline"
            >
              {status.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
