import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { search, type SearchHit, type SearchKind, type Searchable } from '../../../shared/search'
import { TextField } from './Field'
import { Dialog, DialogContent } from './ui/dialog'
import { formatDate } from '@/lib/discovery'

const GROUP_LABELS: Record<SearchKind, string> = { contacts: 'Contacts', interviews: 'Interviews', insights: 'Insights', hypotheses: 'Hypotheses' }

/** Search everything (Ctrl+K): contacts, interviews, insights and hypotheses in one box (backlog #7). */
export function SearchDialog({ onOpen, onClose, onError }: { onOpen: (hit: SearchHit) => void; onClose: () => void; onError: (err: unknown) => void }) {
  const [data, setData] = useState<Searchable | null>(null)
  const [query, setQuery] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([window.api.listContacts(), window.api.listInterviews(), window.api.listInsights(), window.api.listHypotheses()]).then(
      ([contacts, interviews, insights, hypotheses]) => setData({ contacts, interviews, insights, hypotheses }),
      onError
    )
  }, [onError])

  const groups = data ? search(query, data) : []
  const total = groups.reduce((n, g) => n + g.total, 0)

  // Arrow keys move between the box and the results, so the keyboard never has to tab through everything.
  // Radix focuses the search box on open: it is the first focusable element in the dialog.
  const move = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('button[data-hit]') ?? [])]
    if (!items.length) return
    e.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, items.length - 1) : at - 1
    if (next < 0) box.current?.querySelector('input')?.focus()
    else items[next].focus()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Search everything" description="Contacts, interviews, insights and hypotheses.">
        <div ref={box}>
          <TextField
            label="Search"
            hideLabel
            type="search"
            placeholder="Search names, notes, quotes, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = groups[0]?.hits[0]
              if (e.key === 'Enter' && first) onOpen(first)
              else move(e)
            }}
            maxLength={200}
          />
          <p className="sr-only" aria-live="polite">
            {query.trim() && data ? `${total} ${total === 1 ? 'result' : 'results'}` : ''}
          </p>
          <div ref={list} className="mt-3 flex max-h-[55vh] flex-col gap-4 overflow-y-auto">
            {!data ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : query.trim() && !groups.length ? (
              <p>Nothing matches “{query.trim()}”. Every word has to appear somewhere in the same record.</p>
            ) : (
              groups.map((g) => (
                <section key={g.kind} aria-labelledby={`search-${g.kind}`}>
                  <h3 id={`search-${g.kind}`} className="text-[13px] font-semibold text-muted-foreground">
                    {GROUP_LABELS[g.kind]} <span className="tabular">({g.total > g.hits.length ? `${g.hits.length} of ${g.total}` : g.total})</span>
                  </h3>
                  <ul className="mt-1 flex flex-col">
                    {g.hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          data-hit
                          onClick={() => onOpen(h)}
                          onKeyDown={move}
                          className="w-full rounded-md px-2 py-1.5 text-left hover:bg-secondary focus-visible:bg-secondary"
                        >
                          <span className="line-clamp-1 font-semibold">
                            {h.title}
                            {h.date && <span className="font-normal text-muted-foreground">, {formatDate(h.date)}</span>}
                          </span>
                          {h.detail && h.detail !== h.title && <span className="line-clamp-1 text-[13px] text-muted-foreground">{h.detail}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
