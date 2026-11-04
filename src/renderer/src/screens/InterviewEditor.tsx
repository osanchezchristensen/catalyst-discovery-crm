import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  INTERVIEW_FORMATS as FORMATS,
  VERDICTS,
  interviewInput,
  type Contact,
  type EvidenceItem,
  type Hypothesis,
  type Interview,
  type InterviewInput
} from '../../../shared/schema'
import { SelectField, TextAreaField, TextField } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FORMAT_LABELS, NOTE_FIELDS, TYPE_LABELS, VERDICT_LABELS, blankContact, blankInterview, fieldErrors } from '@/lib/discovery'
import { formatDateTime } from '@/lib/utils'

const AUTOSAVE_MS = 5000

const fromInterview = (i: Interview): InterviewInput => ({
  contact_id: i.contact_id,
  date: i.date,
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
const ready = (d: InterviewInput) =>
  !!d.date && (!!d.contact_id || !!d.quotes.trim() || Object.values(d.notes).some((n) => n.trim()))

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
  const [draft, setDraft] = useState<InterviewInput | null>(initialId ? null : blankInterview)
  const [saved, setSaved] = useState(() => (initialId ? '' : JSON.stringify(blankInterview())))
  const [id, setId] = useState(initialId)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [quickContact, setQuickContact] = useState('')
  const saving = useRef(false)

  useEffect(() => {
    window.api.listContacts().then(setContacts, onError)
    window.api.listHypotheses().then(setHypotheses, onError)
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
        const result = await window.api.saveInterview({ ...d, id: currentId ?? undefined })
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
  // Names on the interview stay visible even if a teammate was renamed or removed.
  const people = [...new Set([...team, ...draft.interviewers])]
  const set = (patch: Partial<InterviewInput>) => setDraft({ ...draft, ...patch })
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
        <div className="mt-4 grid grid-cols-[10rem_1fr_10rem] gap-4">
          <TextField
            label="Date"
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            error={errors.date}
          />
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
          <SelectField label="Format" value={draft.format} onChange={(e) => set({ format: e.target.value as InterviewInput['format'] })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </SelectField>
          <div className="col-span-2 col-start-2 flex items-start gap-2">
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

      <Card>
        <CardTitle>Notes</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">Write down what they did, not what they say they would do.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {NOTE_FIELDS.map((f) => (
            <TextAreaField
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={draft.notes[f.key]}
              onChange={(e) => setNote(f.key, e.target.value)}
              maxLength={20000}
            />
          ))}
          <div className="col-span-2">
            <TextAreaField
              label="Key quotes"
              hint="Their exact words. One per line."
              value={draft.quotes}
              onChange={(e) => set({ quotes: e.target.value })}
              maxLength={20000}
            />
          </div>
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
          <TextField label="Next step" value={draft.next_step} onChange={(e) => set({ next_step: e.target.value })} maxLength={20000} />
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
    </div>
  )
}
