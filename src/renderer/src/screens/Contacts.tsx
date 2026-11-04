import { LayoutGrid, Plus, Table2 } from 'lucide-react'
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { CONTACT_STAGES as STAGES, type Contact, type ContactStage, type Segment } from '../../../shared/schema'
import { ContactDialog } from '@/components/ContactDialog'
import { SelectField, TextField } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { STAGE_LABELS, blankContact } from '@/lib/discovery'
import { cn } from '@/lib/utils'

type View = 'board' | 'table'

export function Contacts({
  segments,
  onOpenInterview,
  onNotify,
  onError
}: {
  segments: Segment[]
  onOpenInterview: (id: string) => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [view, setView] = useState<View>('board')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [quickName, setQuickName] = useState('')
  const [quickSegment, setQuickSegment] = useState('')
  const [quickError, setQuickError] = useState<string>()
  const [open, setOpen] = useState<Contact | null>(null)
  const [dropTarget, setDropTarget] = useState<ContactStage | null>(null)

  const reload = useCallback(() => window.api.listContacts().then(setContacts, onError), [onError])
  useEffect(() => void reload(), [reload])

  if (!contacts) return null

  const segmentName = (id: string | null) => segments.find((s) => s.id === id)?.name
  const tags = [...new Set(contacts.flatMap((c) => c.tags))].sort()
  const shown = contacts.filter(
    (c) =>
      (!segmentFilter || (segmentFilter === 'none' ? !c.segment_id : c.segment_id === segmentFilter)) &&
      (!tagFilter || c.tags.includes(tagFilter))
  )

  const move = (id: string, stage: ContactStage) => {
    const c = contacts.find((x) => x.id === id)
    if (!c || c.stage === stage) return
    setContacts(contacts.map((x) => (x.id === id ? { ...x, stage } : x)))
    window.api.setContactStage({ id, stage }).then(
      () => onNotify(`${c.name} moved to ${STAGE_LABELS[stage]}`),
      (err) => {
        onError(err)
        void reload()
      }
    )
  }

  const quickAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!quickName.trim()) return setQuickError('Enter a name')
    try {
      const c = await window.api.saveContact(blankContact(quickName.trim(), quickSegment || null))
      setContacts([...contacts, c])
      setQuickName('')
      setQuickError(undefined)
    } catch (err) {
      onError(err)
    }
  }

  const drop = (stage: ContactStage) => (e: DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
    move(e.dataTransfer.getData('text/plain'), stage)
  }

  const moveSelect = (c: Contact) => (
    <SelectField
      label={`Move ${c.name} to`}
      hideLabel
      value={c.stage}
      onChange={(e) => move(c.id, e.target.value as ContactStage)}
      className="h-8 text-[13px]"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </SelectField>
  )

  const nameButton = (c: Contact) => (
    <button
      type="button"
      onClick={() => setOpen(c)}
      className="truncate text-left font-semibold text-primary underline-offset-2 hover:underline"
    >
      {c.name}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <form onSubmit={quickAdd} noValidate className="flex items-start gap-2">
          <div className="min-w-48 flex-1">
            <TextField
              label="Quick add"
              placeholder="Name of someone to interview…"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              error={quickError}
              maxLength={200}
            />
          </div>
          <div className="w-44">
            <SelectField label="Segment" value={quickSegment} onChange={(e) => setQuickSegment(e.target.value)}>
              <option value="">No segment</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>
          <Button type="submit" className="mt-[22px]">
            <Plus aria-hidden strokeWidth={1.5} />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="w-44">
            <SelectField label="Filter by segment" value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}>
              <option value="">All segments</option>
              <option value="none">No segment</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="w-44">
            <SelectField label="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectField>
          </div>
          <div role="group" aria-label="View" className="ml-auto inline-flex rounded-md border border-primary p-0.5">
            {(
              [
                ['board', 'Board', LayoutGrid],
                ['table', 'Table', Table2]
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-sm px-3 text-[13px] font-semibold transition-colors duration-150 ease-out',
                  view === v ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-secondary'
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {contacts.length === 0 ? (
        <Card>
          <p>No contacts yet. List 20 people in your beachhead segment you could talk to this week.</p>
        </Card>
      ) : view === 'board' ? (
        <div className="grid auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const column = shown.filter((c) => c.stage === stage)
            return (
              <section
                key={stage}
                aria-labelledby={`col-${stage}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(stage)
                }}
                onDragLeave={() => setDropTarget((s) => (s === stage ? null : s))}
                onDrop={drop(stage)}
                className={cn(
                  'flex min-h-40 flex-col gap-2 rounded-lg bg-secondary p-2',
                  dropTarget === stage && 'outline-2 outline-primary outline-dashed'
                )}
              >
                <h2 id={`col-${stage}`} className="flex items-center justify-between px-1 text-[13px] font-semibold">
                  {STAGE_LABELS[stage]}
                  <span className="tabular rounded-full bg-card px-2">{column.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {column.map((c) => (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                      onDragEnd={() => setDropTarget(null)}
                      className="flex cursor-grab flex-col gap-1 rounded-md border border-border bg-card p-3 shadow-sm"
                    >
                      {nameButton(c)}
                      {c.organization && <span className="truncate text-[13px]">{c.organization}</span>}
                      {segmentName(c.segment_id) && (
                        <span className="truncate text-[13px] text-muted-foreground">{segmentName(c.segment_id)}</span>
                      )}
                      {c.tags.length > 0 && (
                        <ul className="flex flex-wrap gap-1" aria-label="Tags">
                          {c.tags.map((t) => (
                            <li key={t} className="rounded-sm bg-secondary px-1.5 text-[13px]">
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                      {moveSelect(c)}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <caption className="sr-only">Contacts, by stage</caption>
            <thead className="bg-secondary text-[13px]">
              <tr>
                {['Name', 'Organization', 'Segment', 'Tags', 'Consent', 'Stage'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...shown]
                .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.name.localeCompare(b.name))
                .map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <th scope="row" className="max-w-56 px-3 py-2 font-normal">
                      {nameButton(c)}
                    </th>
                    <td className="max-w-48 truncate px-3 py-2">{c.organization}</td>
                    <td className="max-w-40 truncate px-3 py-2">{segmentName(c.segment_id)}</td>
                    <td className="max-w-40 truncate px-3 py-2">{c.tags.join(', ')}</td>
                    <td className="px-3 py-2">{c.consent_followup ? 'Yes' : 'No'}</td>
                    <td className="w-40 px-3 py-2">{moveSelect(c)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && (
        <ContactDialog
          key={open.id}
          contact={open}
          segments={segments}
          onClose={() => setOpen(null)}
          onSaved={(c) => {
            setContacts(contacts.map((x) => (x.id === c.id ? c : x)))
            setOpen(null)
            onNotify(`${c.name} saved`)
          }}
          onDeleted={(id) => {
            setContacts(contacts.filter((x) => x.id !== id))
            setOpen(null)
            onNotify('Contact deleted')
          }}
          onOpenInterview={onOpenInterview}
          onError={onError}
        />
      )}
    </div>
  )
}
