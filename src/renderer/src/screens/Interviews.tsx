import { ListOrdered, MessagesSquare, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Guide, Interview } from '../../../shared/schema'
import { GuideEditor } from '@/components/GuideEditor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FORMAT_LABELS, formatDate } from '@/lib/discovery'
import { cn } from '@/lib/utils'

type Tab = 'interviews' | 'guides'

export function Interviews({
  onOpen,
  onNotify,
  onDirtyChange,
  confirmLeave,
  onError
}: {
  onOpen: (id: string | null) => void
  onNotify: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
  /** Asks before discarding unsaved guide edits when switching tabs. */
  confirmLeave: () => boolean
  onError: (err: unknown) => void
}) {
  const [tab, setTab] = useState<Tab>('interviews')
  const options = [
    ['interviews', 'Interviews', MessagesSquare],
    ['guides', 'Guides', ListOrdered]
  ] as const
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show" className="inline-flex self-start rounded-md border border-primary p-0.5">
        {options.map(([t, label, Icon]) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => tab !== t && confirmLeave() && setTab(t)}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-sm px-3 text-[13px] font-semibold transition-colors duration-150 ease-out',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-secondary'
            )}
          >
            <Icon className="size-4" strokeWidth={1.5} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {tab === 'interviews' ? <InterviewList onOpen={onOpen} onError={onError} /> : <Guides onNotify={onNotify} onDirtyChange={onDirtyChange} onError={onError} />}
    </div>
  )
}

function Guides({
  onNotify,
  onDirtyChange,
  onError
}: {
  onNotify: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
  onError: (err: unknown) => void
}) {
  const [guides, setGuides] = useState<Guide[] | null>(null)
  const [open, setOpen] = useState<Guide | 'new' | null>(null)
  useEffect(() => {
    window.api.listGuides().then(setGuides, onError)
  }, [onError])

  if (!guides) return null
  if (open) {
    return (
      <GuideEditor
        key={open === 'new' ? 'new' : open.id}
        guide={open === 'new' ? null : open}
        onClose={() => setOpen(null)}
        onSaved={(g) => {
          setGuides(guides.some((x) => x.id === g.id) ? guides.map((x) => (x.id === g.id ? g : x)) : [...guides, g])
          setOpen(null)
          onNotify('Guide saved')
        }}
        onDeleted={(id) => {
          setGuides(guides.filter((x) => x.id !== id))
          setOpen(null)
          onNotify('Guide deleted')
        }}
        onDirtyChange={onDirtyChange}
        onError={onError}
      />
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setOpen('new')}>
          <Plus aria-hidden strokeWidth={1.5} />
          New guide
        </Button>
      </div>
      {guides.length === 0 ? (
        <Card>
          <p>No guides yet. A guide keeps your questions consistent, so answers are easy to compare across interviews.</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {guides.map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpen(g)}
                className="text-left font-semibold break-words text-primary underline-offset-2 hover:underline"
              >
                {g.name}
              </button>
              <p className="tabular text-[13px] text-muted-foreground">
                {g.questions.length} {g.questions.length === 1 ? 'question' : 'questions'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InterviewList({ onOpen, onError }: { onOpen: (id: string | null) => void; onError: (err: unknown) => void }) {
  const [interviews, setInterviews] = useState<Interview[] | null>(null)
  useEffect(() => {
    window.api.listInterviews().then(setInterviews, onError)
  }, [onError])

  if (!interviews) return null
  const logButton = (
    <Button onClick={() => onOpen(null)}>
      <Plus aria-hidden strokeWidth={1.5} />
      Log interview
    </Button>
  )

  if (interviews.length === 0) {
    return (
      <Card>
        <p>No interviews yet. Most viable ventures start with 10. Log your first.</p>
        <div className="mt-4">{logButton}</div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="tabular">
          {interviews.length} {interviews.length === 1 ? 'interview' : 'interviews'} logged
        </p>
        {logButton}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left">
          <caption className="sr-only">Interviews, newest first</caption>
          <thead className="bg-secondary text-[13px]">
            <tr>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Contact</th>
              <th scope="col" className="px-3 py-2">Format</th>
              <th scope="col" className="px-3 py-2 text-right">Pain (1–5)</th>
              <th scope="col" className="px-3 py-2">Next step</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <th scope="row" className="px-3 py-2 font-normal whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onOpen(i.id)}
                    className="tabular font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {formatDate(i.date)}
                  </button>
                </th>
                <td className="max-w-56 truncate px-3 py-2">{i.contact_name ?? 'No contact'}</td>
                <td className="px-3 py-2">{FORMAT_LABELS[i.format]}</td>
                <td className="tabular px-3 py-2 text-right">{i.pain_score ?? 'Not rated'}</td>
                <td className="max-w-72 truncate px-3 py-2">{i.next_step}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
