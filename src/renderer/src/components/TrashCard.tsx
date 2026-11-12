import { MessageSquare, RotateCcw, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TRASH_DAYS, type TrashItem } from '../../../shared/schema'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/discovery'
import { formatDateTime } from '@/lib/utils'

const DAY_MS = 86_400_000

export const trashLabel = (t: TrashItem) =>
  t.kind === 'contact' ? (t.name ?? 'Contact') : `Interview with ${t.name ?? 'no contact'}, ${formatDate(t.date!)}`

/** Settings card listing deleted contacts and interviews, each restorable until the startup purge. */
export function TrashCard({ onNotify, onError }: { onNotify: (message: string) => void; onError: (err: unknown) => void }) {
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [now] = useState(() => Date.now()) // days left are counted from when the card opened

  useEffect(() => {
    window.api.listTrash().then(setItems, onError)
  }, [onError])

  const drop = (t: TrashItem) => setItems((xs) => xs?.filter((x) => x.id !== t.id) ?? null)
  const restore = async (t: TrashItem) => {
    try {
      await window.api.restoreFromTrash({ kind: t.kind, id: t.id })
      drop(t)
      onNotify(`${trashLabel(t)} restored`)
    } catch (err) {
      onError(err)
    }
  }
  const destroy = async (t: TrashItem) => {
    const what = t.kind === 'contact' ? 'Their interviews stay, without a contact.' : 'Its attachments are deleted too.'
    if (!window.confirm(`Delete ${trashLabel(t)} for good? ${what} This can't be undone.`)) return
    try {
      await window.api.deleteForever({ kind: t.kind, id: t.id })
      drop(t)
      onNotify(`${trashLabel(t)} deleted for good`)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <Card>
      <CardTitle>Trash</CardTitle>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Deleted contacts and interviews stay here for {TRASH_DAYS} days, then they are deleted for good.
      </p>
      {items && !items.length && <p className="mt-4">Trash is empty.</p>}
      {!!items?.length && (
        <ul className="mt-4 divide-y divide-border">
          {items.map((t) => {
            const left = Math.max(0, TRASH_DAYS - Math.floor((now - Date.parse(t.deleted_at)) / DAY_MS))
            const Icon = t.kind === 'contact' ? User : MessageSquare
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    <span className="sr-only">{t.kind === 'contact' ? 'Contact: ' : ''}</span>
                    {trashLabel(t)}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Deleted {formatDateTime(t.deleted_at)} · <span className="tabular">{left}</span> {left === 1 ? 'day' : 'days'} left
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void restore(t)} aria-label={`Restore ${trashLabel(t)}`}>
                  <RotateCcw aria-hidden strokeWidth={1.5} />
                  Restore
                </Button>
                <Button variant="ghost-destructive" size="sm" onClick={() => void destroy(t)} aria-label={`Delete ${trashLabel(t)} for good`}>
                  <Trash2 aria-hidden strokeWidth={1.5} />
                  Delete forever
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
