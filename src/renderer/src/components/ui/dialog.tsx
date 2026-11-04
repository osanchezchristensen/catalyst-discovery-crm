import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export const Dialog = D.Root

export function DialogContent({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 bg-foreground/40" />
      <D.Content className="fixed top-1/2 left-1/2 max-h-[85vh] w-[min(560px,calc(100vw-32px))] overscroll-contain -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-card p-6 shadow-lg">
        <D.Title className="pr-8 text-xl font-semibold">{title}</D.Title>
        {description ? (
          <D.Description className="mt-1 text-muted-foreground">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className="mt-4">{children}</div>
        <D.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" aria-hidden />
        </D.Close>
      </D.Content>
    </D.Portal>
  )
}
