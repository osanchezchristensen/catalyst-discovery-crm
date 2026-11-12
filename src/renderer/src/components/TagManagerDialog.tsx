import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { TextField } from './Field'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

/** Rename, merge or delete insight tags in one place, so "price" and "pricing" become one tag (backlog #11). */
export function TagManagerDialog({
  counts,
  onClose,
  onChanged,
  onError
}: {
  /** Each tag with how many insights use it. */
  counts: [string, number][]
  onClose: () => void
  onChanged: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const existing = new Set(counts.map(([t]) => t))

  const apply = async (from: string, to: string | null, message: string) => {
    setBusy(true)
    try {
      await window.api.renameTag({ from, to })
      onChanged(message)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  const rename = (from: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const to = (names[from] ?? '').trim().toLowerCase()
    if (!to || to === from) return
    void apply(from, to, existing.has(to) ? `Merged “${from}” into “${to}”.` : `Renamed “${from}” to “${to}”.`)
  }
  const remove = (tag: string, n: number) => {
    if (!window.confirm(`Remove the tag “${tag}” from ${n} ${n === 1 ? 'insight' : 'insights'}? The insights stay.`)) return
    void apply(tag, null, `Removed the tag “${tag}”.`)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title="Manage tags" description="Rename a tag to an existing name to merge the two. Removing a tag keeps its insights.">
        {counts.length === 0 ? (
          <p>No tags yet. Tag insights to group them.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {counts.map(([tag, n]) => {
              const to = (names[tag] ?? '').trim().toLowerCase()
              return (
                <li key={tag}>
                  <form onSubmit={rename(tag)} className="flex items-start gap-2">
                    <div className="flex-1">
                      <TextField
                        label={`Rename “${tag}” (${n} ${n === 1 ? 'insight' : 'insights'})`}
                        placeholder={tag}
                        value={names[tag] ?? ''}
                        onChange={(e) => setNames({ ...names, [tag]: e.target.value })}
                        hint={to && to !== tag && existing.has(to) ? `Merges into the existing tag “${to}”.` : undefined}
                        maxLength={200}
                        disabled={busy}
                      />
                    </div>
                    <Button type="submit" variant="secondary" className="mt-6" disabled={busy || !to || to === tag}>
                      {to && to !== tag && existing.has(to) ? 'Merge' : 'Rename'}
                    </Button>
                    <Button variant="ghost-destructive" className="mt-6" onClick={() => remove(tag, n)} disabled={busy}>
                      <Trash2 aria-hidden strokeWidth={1.5} />
                      <span className="sr-only">Remove the tag “{tag}”</span>
                    </Button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
