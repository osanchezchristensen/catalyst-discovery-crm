import { ArrowLeft, ExternalLink, FolderOpen, ListChecks, Paperclip, Plus, Quote, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import {
  INTERVIEW_FORMATS as FORMATS,
  INTERVIEW_TYPES,
  VERDICTS,
  interviewInput,
  type Contact,
  type Attachment,
  type EvidenceItem,
  type Guide,
  type Insight,
  type Hypothesis,
  type Interview,
  type InterviewInput,
  type InterviewType
} from '../../../shared/schema'
import { noteToPlain } from '../../../shared/notes'
import { SelectField, TextAreaField, TextField } from '@/components/Field'
import { InsightDialog } from '@/components/InsightDialog'
import { NotesEditor } from '@/components/NotesEditor'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import {
  FORMAT_LABELS,
  INTERVIEW_TYPE_LABELS,
  NOTE_FIELDS,
  TYPE_LABELS,
  VERDICT_LABELS,
  blankContact,
  blankInterview,
  fieldErrors,
  type InterviewDraft
} from '@/lib/discovery'
import { formatDateTime } from '@/lib/utils'

const AUTOSAVE_MS = 5000

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const fromInterview = (i: Interview): InterviewDraft => ({
  contact_id: i.contact_id,
  date: i.date,
  type: i.type,
  format: i.format,
  interviewers: i.interviewers,
  notes: i.notes,
  quotes: i.quotes,
  pain_score: i.pain_score,
  wtp_signal: i.wtp_signal,
  next_step: i.next_step,
  follow_up_date: i.follow_up_date,
  evidence: i.evidence
})

/** Worth saving once it has a date and either a contact or some notes. */
const ready = (d: InterviewDraft) =>
  !!d.date && (!!d.contact_id || !!d.quotes.trim() || Object.values(d.notes).some((n) => noteToPlain(n).trim()))

/** Create or edit one interview. Autosaves every 5 seconds while there are unsaved changes. */
export function InterviewEditor({
  id: initialId,
  team,
  onBack,
  onDirtyChange,
  onNotify,
  onError
}: {
  id: string | null
  team: string[]
  onBack: () => void
  onDirtyChange: (dirty: boolean) => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [draft, setDraft] = useState<InterviewDraft | null>(initialId ? null : blankInterview)
  const [saved, setSaved] = useState(() => (initialId ? '' : JSON.stringify(blankInterview())))
  const [id, setId] = useState(initialId)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [guideId, setGuideId] = useState('')
  const [insights, setInsights] = useState<Insight[]>([])
  const [selection, setSelection] = useState({ text: '', quote: false })
  const [insightDraft, setInsightDraft] = useState<{ text: string; is_quote: boolean } | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [followUpFor, setFollowUpFor] = useState('') // the next step already turned into a follow-up
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [quickContact, setQuickContact] = useState('')
  const saving = useRef(false)

  useEffect(() => {
    window.api.listContacts().then(setContacts, onError)
    window.api.listHypotheses().then(setHypotheses, onError)
    window.api.listGuides().then(setGuides, onError)
    if (initialId) window.api.listInsights().then((all) => setInsights(all.filter((n) => n.interview_id === initialId)), onError)
    if (initialId) window.api.listAttachments(initialId).then(setAttachments, onError)
    if (!initialId) return
    window.api.getInterview(initialId).then((i) => {
      if (!i) return onBack()
      const d = fromInterview(i)
      setDraft(d)
      setSaved(JSON.stringify(d))
    }, onError)
  }, [initialId, onBack, onError])

  const dirty = !!draft && JSON.stringify(draft) !== saved
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  // The interval reads the latest state through a ref so it never saves a stale draft.
  const latest = useRef({ draft, saved, id })
  useEffect(() => {
    latest.current = { draft, saved, id }
  })

  const save = useCallback(
    async (manual: boolean): Promise<boolean> => {
      // Wait out an autosave already in flight (e.g. Done clicked mid-save), then save what's newest.
      while (saving.current) await new Promise((r) => setTimeout(r, 50))
      const { draft: d, saved: s, id: currentId } = latest.current
      if (!d) return false
      const snapshot = JSON.stringify(d)
      if (snapshot === s && currentId) return true
      if (!ready(d)) {
        if (manual) setErrors({ contact_id: 'Pick a contact or write some notes first' })
        return false
      }
      const parsed = interviewInput.safeParse({ ...d, id: currentId ?? undefined })
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error.issues))
        setStatus('Not saved: fix the highlighted fields.')
        return false
      }
      saving.current = true
      setStatus('Saving…')
      try {
        const result = await window.api.saveInterview({ ...d, type: parsed.data.type, id: currentId ?? undefined })
        setId(result.id)
        setSaved(snapshot)
        setErrors({})
        setStatus(`Saved ${formatDateTime(result.updated_at)}`)
        return true
      } catch (err) {
        setStatus('Not saved.')
        onError(err)
        return false
      } finally {
        saving.current = false
      }
    },
    [onError]
  )

  useEffect(() => {
    const t = setInterval(() => void save(false), AUTOSAVE_MS)
    return () => clearInterval(t)
  }, [save])

  if (!draft) return null
  const guide = guides.find((g) => g.id === guideId)
  /** Remembers highlighted text in the quotes box so it can become an insight (notes boxes report theirs directly). */
  const capture = (quote: boolean) => (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget
    const text = t.value.slice(t.selectionStart, t.selectionEnd).trim()
    if (text) setSelection({ text, quote })
  }
  const attach = async () => {
    if (!id) return
    try {
      const a = await window.api.addAttachment(id)
      if ('id' in a) setAttachments([...attachments, a])
    } catch (err) {
      onError(err)
    }
  }
  const detach = async (a: Attachment) => {
    if (!window.confirm(`Remove "${a.file_name}" from this interview? The copy in the app is deleted; your original file stays.`)) return
    try {
      await window.api.deleteAttachment(a.id)
      setAttachments(attachments.filter((x) => x.id !== a.id))
    } catch (err) {
      onError(err)
    }
  }
  const addFollowUp = async () => {
    try {
      await window.api.saveTask({ title: draft.next_step.trim(), due_date: draft.follow_up_date, interview_id: id, done: false })
      setFollowUpFor(draft.next_step.trim())
      onNotify('Follow-up added to Home')
    } catch (err) {
      onError(err)
    }
  }
  // Names on the interview stay visible even if a teammate was renamed or removed.
  const people = [...new Set([...team, ...draft.interviewers])]
  const set = (patch: Partial<InterviewDraft>) => setDraft({ ...draft, ...patch })
  const setNote = (key: keyof InterviewInput['notes'], value: string) => set({ notes: { ...draft.notes, [key]: value } })
  const evidence = draft.evidence ?? []
  const linkOf = (hypothesisId: string) => evidence.find((e) => e.hypothesis_id === hypothesisId)
  /** verdict null removes the link; otherwise adds or updates it. */
  const setLink = (hypothesisId: string, patch: Partial<EvidenceItem> | null) => {
    const old = linkOf(hypothesisId)
    const rest = evidence.filter((e) => e.hypothesis_id !== hypothesisId)
    if (!patch) return set({ evidence: rest })
    const next: EvidenceItem = { hypothesis_id: hypothesisId, verdict: 'supports', note: '', ...old, ...patch }
    set({ evidence: old ? evidence.map((e) => (e.hypothesis_id === hypothesisId ? next : e)) : [...evidence, next] })
  }

  const done = async () => {
    if (!dirty || (await save(true))) {
      onDirtyChange(false)
      onBack()
    }
  }

  const addContact = async () => {
    if (!quickContact.trim()) return
    try {
      const c = await window.api.saveContact(blankContact(quickContact.trim()))
      setContacts([...contacts, c])
      set({ contact_id: c.id })
      setQuickContact('')
    } catch (err) {
      onError(err)
    }
  }

  const remove = async () => {
    if (!id || !window.confirm("Delete this interview? This can't be undone.")) return
    try {
      await window.api.deleteInterview(id)
      onDirtyChange(false)
      onNotify('Interview deleted')
      onBack()
    } catch (err) {
      onError(err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={done}>
          <ArrowLeft aria-hidden strokeWidth={1.5} />
          All interviews
        </Button>
      </div>

      <Card>
        <CardTitle>Who and when</CardTitle>
        {/* Contact gets the wide column; Type and Format share a row so the type hint can wrap without pushing other fields. */}
        <div className="mt-4 grid grid-cols-[1fr_1fr_10rem] gap-4">
          <div className="col-span-2">
            <SelectField
              label="Contact"
              value={draft.contact_id ?? ''}
              onChange={(e) => set({ contact_id: e.target.value || null })}
              error={errors.contact_id}
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization ? `${c.name}, ${c.organization}` : c.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Date"
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            error={errors.date}
          />
          <div className="col-span-2 flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label="New contact"
                hideLabel
                placeholder="Or add a new contact by name…"
                value={quickContact}
                onChange={(e) => setQuickContact(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addContact()
                  }
                }}
                maxLength={200}
              />
            </div>
            <Button variant="secondary" onClick={addContact} disabled={!quickContact.trim()}>
              <Plus aria-hidden strokeWidth={1.5} />
              Add contact
            </Button>
          </div>
          <div />
          <SelectField
            label="Type"
            value={draft.type}
            onChange={(e) => set({ type: e.target.value as InterviewType })}
            error={errors.type}
            hint={draft.type ? INTERVIEW_TYPE_LABELS[draft.type].hint : undefined}
            required
          >
            <option value="" disabled>
              Choose a type…
            </option>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {INTERVIEW_TYPE_LABELS[t].label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Format" value={draft.format} onChange={(e) => set({ format: e.target.value as InterviewInput['format'] })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </SelectField>
        </div>
        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold">Interviewers</legend>
          {people.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted-foreground">Add your team on the Venture screen to pick interviewers.</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-4">
              {people.map((name) => (
                <label key={name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={draft.interviewers.includes(name)}
                    onChange={(e) =>
                      set({
                        interviewers: e.target.checked
                          ? [...draft.interviewers, name]
                          : draft.interviewers.filter((n) => n !== name)
                      })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </Card>

      {guides.length > 0 && (
        <Card>
          <div className="flex items-end justify-between gap-4">
            <CardTitle>Interview guide</CardTitle>
            <div className="w-64">
              <SelectField label="Guide" hideLabel value={guideId} onChange={(e) => setGuideId(e.target.value)}>
                <option value="">No guide</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
          {guide && (
            <ol className="mt-3 flex flex-col gap-1">
              {guide.questions.map((q, n) => (
                <li key={n}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" />
                    <span className="break-words">{q}</span>
                  </label>
                </li>
              ))}
            </ol>
          )}
          {!guide && <p className="mt-2 text-[13px] text-muted-foreground">Pick a guide to keep your questions in view. Ticks aren&apos;t saved.</p>}
        </Card>
      )}

      <Card>
        <CardTitle>Notes</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">Write down what they did, not what they say they would do.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {NOTE_FIELDS.map((f) => (
            <NotesEditor
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={draft.notes[f.key]}
              onChange={(html) => setNote(f.key, html)}
              onSelectText={(text) => setSelection({ text, quote: false })}
            />
          ))}
          <div className="col-span-2">
            <TextAreaField
              label="Key quotes"
              hint="Their exact words. One per line."
              value={draft.quotes}
              onChange={(e) => set({ quotes: e.target.value })}
              onSelect={capture(true)}
              maxLength={20000}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Insights</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Highlight a line in your notes or quotes, then save it as an insight and tag it.
        </p>
        {insights.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {insights.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline gap-2">
                {n.is_quote && <Quote className="size-4 shrink-0 self-center" strokeWidth={1.5} aria-label="Quote" />}
                <span className="break-words">{n.text}</span>
                {n.tags.length > 0 && <span className="text-[13px] text-muted-foreground">({n.tags.join(', ')})</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!id}
            onClick={() => setInsightDraft({ text: selection.text, is_quote: selection.quote })}
          >
            <Sparkles aria-hidden strokeWidth={1.5} />
            {selection.text ? 'Save highlighted text as insight' : 'Add insight'}
          </Button>
          {!id && <span className="text-[13px] text-muted-foreground">Insights can be added once the interview has saved.</span>}
        </div>
      </Card>

      <Card>
        <CardTitle>Evidence</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          For each hypothesis, did this interview support it, refute it, or neither?
        </p>
        {hypotheses.length === 0 ? (
          <p className="mt-4">No hypotheses yet. Add them on the Hypotheses screen, then link this interview.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {hypotheses.map((h) => {
              const link = linkOf(h.id)
              return (
                <li key={h.id}>
                  <fieldset>
                    <legend className="font-semibold break-words">
                      <span className="text-[13px] font-normal text-muted-foreground">{TYPE_LABELS[h.type]}: </span>
                      {h.statement}
                    </legend>
                    <div className="mt-1 flex flex-wrap gap-4">
                      {([null, ...VERDICTS] as const).map((v) => (
                        <label key={v ?? 'none'} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`verdict-${h.id}`}
                            className="size-4 accent-primary"
                            checked={(link?.verdict ?? null) === v}
                            onChange={() => setLink(h.id, v ? { verdict: v } : null)}
                          />
                          {v ? VERDICT_LABELS[v] : 'Not linked'}
                        </label>
                      ))}
                    </div>
                    {link && (
                      <div className="mt-2">
                        <TextField
                          label={`Evidence note for: ${h.statement}`}
                          hideLabel
                          placeholder="What did they say or do that shows this…"
                          value={link.note}
                          onChange={(e) => setLink(h.id, { note: e.target.value })}
                          maxLength={20000}
                        />
                      </div>
                    )}
                  </fieldset>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Attachments</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Whiteboard photos, survey screenshots or a short clip the person agreed to. Photos, audio, video or PDF, up to 25 MB. Copies stay on
          this computer.
        </p>
        {attachments.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <Paperclip className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={a.file_name}>
                  {a.file_name}
                </span>
                <span className="tabular text-[13px] text-muted-foreground">{fileSize(a.bytes)}</span>
                <Button variant="ghost" size="sm" onClick={() => window.api.openAttachment(a.id).catch(onError)}>
                  <ExternalLink aria-hidden strokeWidth={1.5} />
                  Open
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.api.showAttachment(a.id).catch(onError)}>
                  <FolderOpen aria-hidden strokeWidth={1.5} />
                  Show in folder
                </Button>
                <Button variant="ghost-destructive" size="icon" aria-label={`Remove ${a.file_name}`} onClick={() => detach(a)}>
                  <X aria-hidden strokeWidth={1.5} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={!id} onClick={attach}>
            <Paperclip aria-hidden strokeWidth={1.5} />
            Add file
          </Button>
          {!id && <span className="text-[13px] text-muted-foreground">Files can be added once the interview has saved.</span>}
        </div>
      </Card>

      <Card>
        <CardTitle>Signals and next step</CardTitle>
        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold">Pain intensity</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            {[null, 1, 2, 3, 4, 5].map((n) => (
              <label key={n ?? 'none'} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pain"
                  className="size-4 accent-primary"
                  checked={draft.pain_score === n}
                  onChange={() => set({ pain_score: n })}
                />
                {n === null ? 'Not rated' : n === 1 ? '1 (mild)' : n === 5 ? '5 (severe)' : n}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 grid grid-cols-[1fr_1fr_10rem] gap-4">
          <TextField
            label="Willingness-to-pay signal"
            placeholder="Asked for a pilot, pre-ordered, made an intro…"
            value={draft.wtp_signal}
            onChange={(e) => set({ wtp_signal: e.target.value })}
            maxLength={200}
          />
          <div>
            <TextField label="Next step" value={draft.next_step} onChange={(e) => set({ next_step: e.target.value })} maxLength={20000} />
            <Button variant="ghost" size="sm" className="mt-1" disabled={!draft.next_step.trim() || draft.next_step.trim() === followUpFor} onClick={addFollowUp}>
              <ListChecks aria-hidden strokeWidth={1.5} />
              Add as follow-up
            </Button>
          </div>
          <TextField
            label="Follow-up date"
            type="date"
            value={draft.follow_up_date ?? ''}
            onChange={(e) => set({ follow_up_date: e.target.value || null })}
            error={errors.follow_up_date}
          />
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-border bg-background px-6 py-3">
        {id ? (
          <Button variant="ghost-destructive" onClick={remove}>
            <Trash2 aria-hidden strokeWidth={1.5} />
            Delete interview
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-muted-foreground" aria-live="polite">
            {status || (dirty ? 'Saves automatically every 5 seconds.' : '')}
          </span>
          <Button onClick={done}>Done</Button>
        </div>
      </div>
      {insightDraft && id && (
        <InsightDialog
          insight={null}
          draft={{ ...insightDraft, interview_id: id }}
          onClose={() => setInsightDraft(null)}
          onSaved={(n) => {
            setInsightDraft(null)
            setSelection({ text: '', quote: false })
            setInsights([n, ...insights])
            onNotify('Insight saved')
          }}
          onError={onError}
        />
      )}
    </div>
  )
}
