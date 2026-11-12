import { Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { CONTACT_SOURCES as SOURCES, CONTACT_STAGES as STAGES, contactInput, type Contact, type ContactInput, type Interview, type Segment } from '../../../shared/schema'
import { SelectField, TextAreaField, TextField } from './Field'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FORMAT_LABELS, SOURCE_LABELS, STAGE_LABELS, fieldErrors, formatDate } from '@/lib/discovery'
import { focusFirstError } from '@/lib/utils'

const toDraft = (c: Contact): ContactInput & { tagText: string } => ({ ...c, tagText: c.tags.join(', ') })

/** Edit a contact, see its interviews, or delete it (consent requests). */
export function ContactDialog({
  contact,
  segments,
  onClose,
  onSaved,
  onDeleted,
  onOpenInterview,
  onError
}: {
  contact: Contact
  segments: Segment[]
  onClose: () => void
  onSaved: (c: Contact) => void
  onDeleted: (id: string) => void
  onOpenInterview: (id: string) => void
  onError: (err: unknown) => void
}) {
  const [draft, setDraft] = useState(() => toDraft(contact))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [others, setOthers] = useState<Contact[]>([])

  useEffect(() => {
    window.api.listInterviews().then((all) => setInterviews(all.filter((i) => i.contact_id === contact.id)), onError)
    window.api.listContacts().then((all) => setOthers(all.filter((c) => c.id !== contact.id)), onError)
  }, [contact, onError])

  const set = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch })

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { tagText, ...rest } = draft
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean)
    const parsed = contactInput.safeParse({ ...rest, tags })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    setBusy(true)
    try {
      onSaved(await window.api.saveContact({ ...rest, tags }))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete ${contact.name}? Their interviews stay, without a contact. This can't be undone.`)) return
    try {
      await window.api.deleteContact(contact.id)
      onDeleted(contact.id)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title={contact.name} description={STAGE_LABELS[contact.stage]}>
        <form onSubmit={save} noValidate>
          <fieldset disabled={busy} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} maxLength={200} />
            </div>
            <TextField label="Organization" value={draft.organization} onChange={(e) => set({ organization: e.target.value })} maxLength={200} />
            <TextField label="Role" value={draft.role} onChange={(e) => set({ role: e.target.value })} maxLength={200} />
            <TextField
              label="Email"
              type="email"
              spellCheck={false}
              value={draft.email}
              onChange={(e) => set({ email: e.target.value })}
              error={errors.email}
              maxLength={200}
            />
            <TextField label="Phone" type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={200} />
            <SelectField label="Segment" value={draft.segment_id ?? ''} onChange={(e) => set({ segment_id: e.target.value || null })}>
              <option value="">No segment</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Source"
              value={draft.source ?? ''}
              onChange={(e) => set({ source: (e.target.value || null) as ContactInput['source'] })}
            >
              <option value="">Not set</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Referred by"
              value={draft.referred_by ?? ''}
              onChange={(e) => set({ referred_by: e.target.value || null })}
              error={errors.referred_by}
            >
              <option value="">Nobody</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization ? `${c.name}, ${c.organization}` : c.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Stage" value={draft.stage} onChange={(e) => set({ stage: e.target.value as ContactInput['stage'] })}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Tags"
              hint="Separate with commas."
              placeholder="staff, night shift…"
              value={draft.tagText}
              onChange={(e) => set({ tagText: e.target.value })}
              error={errors.tags ?? errors['tags.0']}
            />
            <label className="col-span-2 flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draft.consent_followup}
                onChange={(e) => set({ consent_followup: e.target.checked })}
              />
              Agreed to follow-up contact
            </label>
            <div className="col-span-2">
              <TextAreaField label="Notes" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={20000} />
            </div>
          </fieldset>

          <h3 className="mt-6 font-semibold">Interviews</h3>
          {interviews.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted-foreground">No interviews with {contact.name} yet.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {interviews.map((i) => (
                <li key={i.id}>
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => onOpenInterview(i.id)}>
                    {formatDate(i.date)}, {FORMAT_LABELS[i.format]}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button variant="ghost-destructive" onClick={remove} disabled={busy}>
              <Trash2 aria-hidden strokeWidth={1.5} />
              Delete contact
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save contact'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
