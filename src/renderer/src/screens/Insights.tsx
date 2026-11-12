import { Plus, Quote, Tags } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Insight } from '../../../shared/schema'
import { SelectField } from '@/components/Field'
import { InsightDialog } from '@/components/InsightDialog'
import { TagManagerDialog } from '@/components/TagManagerDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/discovery'

const UNTAGGED = 'Untagged'

/** Affinity grid: one column per tag, biggest first, so patterns across interviews stand out. */
export function Insights({
  onOpenInterview,
  onNotify,
  onError
}: {
  onOpenInterview: (id: string) => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [items, setItems] = useState<Insight[] | null>(null)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<Insight | 'new' | null>(null)
  const [managing, setManaging] = useState(false)
  const reload = useCallback(() => window.api.listInsights().then(setItems, onError), [onError])
  useEffect(() => void reload(), [reload])

  if (!items) return null

  const columns = new Map<string, Insight[]>()
  for (const n of items) for (const tag of n.tags.length ? n.tags : [UNTAGGED]) columns.set(tag, [...(columns.get(tag) ?? []), n])
  const sorted = [...columns]
    .sort(([a, x], [b, y]) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : y.length - x.length || a.localeCompare(b)))
    .filter(([tag]) => !filter || tag === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="w-56">
          <SelectField label="Show tag" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All tags</option>
            {[...columns.keys()].sort().map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setManaging(true)}>
            <Tags aria-hidden strokeWidth={1.5} />
            Manage tags
          </Button>
          <Button variant="secondary" onClick={() => setOpen('new')}>
            <Plus aria-hidden strokeWidth={1.5} />
            Add insight
          </Button>
        </div>
      </div>
      {managing && (
        <TagManagerDialog
          counts={[...columns].filter(([t]) => t !== UNTAGGED).map(([t, list]) => [t, list.length] as [string, number]).sort((a, b) => a[0].localeCompare(b[0]))}
          onClose={() => setManaging(false)}
          onChanged={(message) => {
            setFilter('')
            onNotify(message)
            void reload()
          }}
          onError={onError}
        />
      )}

      {items.length === 0 ? (
        <Card>
          <p>No insights yet. In an interview, highlight a line in your notes and save it as an insight, then tag it.</p>
        </Card>
      ) : (
        <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {sorted.map(([tag, list]) => (
            <section key={tag} aria-labelledby={`tag-${tag}`} className="flex flex-col gap-2 rounded-lg bg-secondary p-2">
              <h2 id={`tag-${tag}`} className="flex items-center justify-between px-1 text-[13px] font-semibold">
                <span className="truncate">{tag}</span>
                <span className="tabular rounded-full bg-card px-2">{list.length}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((n) => (
                  <li key={n.id} className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setOpen(n)}
                      className="text-left break-words text-primary underline-offset-2 hover:underline"
                    >
                      {n.is_quote ? (
                        <span className="flex gap-1 italic">
                          <Quote className="mt-1 size-4 shrink-0" strokeWidth={1.5} aria-label="Quote" />“{n.text}”
                        </span>
                      ) : (
                        n.text
                      )}
                    </button>
                    {n.interview_id && n.date && (
                      <button
                        type="button"
                        onClick={() => onOpenInterview(n.interview_id!)}
                        className="text-left text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {n.contact_name ?? 'No contact'}, {formatDate(n.date)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {open && (
        <InsightDialog
          key={open === 'new' ? 'new' : open.id}
          insight={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null)
            onNotify('Insight saved')
            void reload()
          }}
          onDeleted={() => {
            setOpen(null)
            onNotify('Insight deleted')
            void reload()
          }}
          onError={onError}
        />
      )}
    </div>
  )
}
