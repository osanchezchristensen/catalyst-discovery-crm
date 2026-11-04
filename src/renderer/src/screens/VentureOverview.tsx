import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Member, Segment, VentureBundle } from '../../../shared/schema'
import { SelectField, STAGE_OPTIONS, TextAreaField, TextField } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { focusFirstError } from '@/lib/utils'

type Row<T> = Omit<T, 'id'> & { id?: string; key: string }
type Draft = {
  venture: Pick<VentureBundle['venture'], 'id' | 'name' | 'pitch' | 'problem' | 'stage' | 'semester'>
  members: Row<Member>[]
  segments: Row<Segment>[]
}
type Errors = Record<string, string>

let nextKey = 0
const key = () => `new-${nextKey++}`

function fromBundle(b: VentureBundle): Draft {
  const { id, name, pitch, problem, stage, semester } = b.venture
  return {
    venture: { id, name, pitch, problem, stage, semester },
    members: b.members.map((m) => ({ ...m, key: m.id })),
    segments: b.segments.map((s) => ({ ...s, key: s.id }))
  }
}

function validate(d: Draft): Errors {
  const e: Errors = {}
  if (!d.venture.name.trim()) e.name = 'Give your venture a name'
  d.segments.forEach((s) => {
    if (!s.name.trim()) e[`segment-${s.key}`] = 'Name this segment or remove it'
  })
  d.members.forEach((m) => {
    if (!m.name.trim()) e[`member-${m.key}`] = 'Enter a name or remove this person'
  })
  return e
}

/** Remount with a new `key` after each save so the draft resets to saved data. */
export function VentureOverview({
  bundle,
  onSaved,
  onError,
  onDirtyChange
}: {
  bundle: VentureBundle
  onSaved: (b: VentureBundle) => void
  onError: (err: unknown) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(() => fromBundle(bundle))
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(fromBundle(bundle))
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  const setVenture = (patch: Partial<Draft['venture']>) => setDraft((d) => ({ ...d, venture: { ...d.venture, ...patch } }))
  const setSegment = (i: number, patch: Partial<Row<Segment>>) =>
    setDraft((d) => ({
      ...d,
      segments: d.segments.map((s, j) =>
        j === i ? { ...s, ...patch } : patch.is_beachhead ? { ...s, is_beachhead: false } : s
      )
    }))
  const setMember = (i: number, patch: Partial<Row<Member>>) =>
    setDraft((d) => ({ ...d, members: d.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) }))

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length) return focusFirstError(e.currentTarget)
    setBusy(true)
    try {
      onSaved(
        await window.api.saveVenture({
          venture: draft.venture,
          members: draft.members.map(({ id, name, role }) => ({ id, name, role })),
          segments: draft.segments.map(({ id, name, description, is_beachhead }) => ({ id, name, description, is_beachhead }))
        })
      )
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <fieldset disabled={busy} className="flex flex-col gap-6">
        <Card>
          <CardTitle>Basics</CardTitle>
          <div className="mt-4 grid grid-cols-[1fr_15rem_10rem] gap-4">
            <TextField
              label="Venture name"
              value={draft.venture.name}
              onChange={(e) => setVenture({ name: e.target.value })}
              error={errors.name}
              maxLength={200}
            />
            <SelectField
              label="Catalyst stage"
              value={draft.venture.stage}
              onChange={(e) => setVenture({ stage: Number(e.target.value) })}
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Semester"
              placeholder="Fall 2026…"
              value={draft.venture.semester}
              onChange={(e) => setVenture({ semester: e.target.value })}
              maxLength={200}
            />
            <div className="col-span-3">
              <TextField
                label="One-line pitch"
                placeholder="We help [customer] do [job] by [how]…"
                value={draft.venture.pitch}
                onChange={(e) => setVenture({ pitch: e.target.value })}
                maxLength={2000}
              />
            </div>
            <div className="col-span-3">
              <TextAreaField
                label="Problem statement"
                hint="Whose problem is it, and what do they do about it today?"
                value={draft.venture.problem}
                onChange={(e) => setVenture({ problem: e.target.value })}
                maxLength={20000}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Customer segments</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pick one beachhead: the segment you’ll interview first.
          </p>
          {draft.segments.length === 0 ? (
            <p className="mt-4">No segments yet. Name 1–3 groups of people you think have this problem.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {draft.segments.map((s, i) => (
                <li key={s.key} className="grid grid-cols-[1fr_1.5fr_auto_auto] items-start gap-3">
                  <TextField
                    label={`Segment ${i + 1} name`}
                    hideLabel
                    placeholder="Segment name…"
                    value={s.name}
                    onChange={(e) => setSegment(i, { name: e.target.value })}
                    error={errors[`segment-${s.key}`]}
                    maxLength={200}
                  />
                  <TextField
                    label={`Segment ${i + 1} description`}
                    hideLabel
                    placeholder="Who they are, in a few words…"
                    value={s.description}
                    onChange={(e) => setSegment(i, { description: e.target.value })}
                    maxLength={2000}
                  />
                  <label className="flex h-9 items-center gap-2 text-[13px] font-semibold">
                    <input
                      type="radio"
                      name="beachhead"
                      className="size-4 accent-primary"
                      checked={s.is_beachhead}
                      onChange={() => setSegment(i, { is_beachhead: true })}
                    />
                    Beachhead
                  </label>
                  <Button
                    variant="ghost-destructive"
                    size="icon"
                    aria-label={`Remove segment ${s.name || i + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, segments: d.segments.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 strokeWidth={1.5} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                segments: [...d.segments, { key: key(), name: '', description: '', is_beachhead: d.segments.length === 0 }]
              }))
            }
          >
            <Plus aria-hidden strokeWidth={1.5} />
            Add segment
          </Button>
        </Card>

        <Card>
          <CardTitle>Team</CardTitle>
          {draft.members.length === 0 ? (
            <p className="mt-4">No team members yet. Add everyone who runs interviews.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {draft.members.map((m, i) => (
                <li key={m.key} className="grid grid-cols-[1fr_12rem_auto] items-start gap-3">
                  <TextField
                    label={`Team member ${i + 1} name`}
                    hideLabel
                    placeholder="Full name…"
                    value={m.name}
                    onChange={(e) => setMember(i, { name: e.target.value })}
                    error={errors[`member-${m.key}`]}
                    maxLength={200}
                  />
                  <SelectField
                    label={`Team member ${i + 1} role`}
                    hideLabel
                    value={m.role}
                    onChange={(e) => setMember(i, { role: e.target.value as Member['role'] })}
                  >
                    <option value="owner">Owner</option>
                    <option value="member">Member</option>
                  </SelectField>
                  <Button
                    variant="ghost-destructive"
                    size="icon"
                    aria-label={`Remove ${m.name || `team member ${i + 1}`}`}
                    onClick={() => setDraft((d) => ({ ...d, members: d.members.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 strokeWidth={1.5} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setDraft((d) => ({ ...d, members: [...d.members, { key: key(), name: '', role: 'member' }] }))}
          >
            <Plus aria-hidden strokeWidth={1.5} />
            Add team member
          </Button>
        </Card>
      </fieldset>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-4 border-t border-border bg-background px-6 py-3">
        <span className="text-[13px] text-muted-foreground" aria-live="polite">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <Button type="submit" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
