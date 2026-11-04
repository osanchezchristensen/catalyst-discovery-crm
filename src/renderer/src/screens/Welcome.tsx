import { FileUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Profile } from '../../../shared/schema'
import { SelectField, STAGE_OPTIONS, TextField } from '@/components/Field'
import { Wordmark } from '@/components/Wordmark'
import { focusFirstError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function Welcome({
  profile,
  hasVenture,
  onDone,
  onImport,
  onError
}: {
  profile: Profile | null
  hasVenture: boolean
  onDone: () => void
  onImport: () => void
  onError: (err: unknown) => void
}) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [stage, setStage] = useState(profile?.stage ?? 1)
  const [venture, setVenture] = useState('')
  const [errors, setErrors] = useState<{ name?: string; venture?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = {
      name: name.trim() ? undefined : 'Enter your name',
      venture: hasVenture || venture.trim() ? undefined : 'Name your venture. You can change it later.'
    }
    setErrors(next)
    if (next.name || next.venture) return focusFirstError(e.currentTarget)
    setBusy(true)
    try {
      await window.api.saveProfile({ full_name: name.trim(), stage })
      if (!hasVenture) await window.api.createVenture({ name: venture.trim(), stage })
      onDone()
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <Wordmark className="text-primary" />
        <h1 className="mt-4 font-heading text-[32px] leading-tight font-semibold">Welcome</h1>
        <p className="mt-1 text-muted-foreground">
          {hasVenture
            ? 'Your workspace is imported. Tell us who you are.'
            : 'Talk to customers. Test the idea. Know what’s real. Start with your name and venture.'}
        </p>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
          <TextField
            label="Your name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            maxLength={200}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- first field of a one-purpose screen
            autoFocus
          />
          <SelectField label="Your Catalyst stage" value={stage} onChange={(e) => setStage(Number(e.target.value))}>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          {!hasVenture && (
            <TextField
              label="Venture name"
              name="venture"
              autoComplete="off"
              value={venture}
              onChange={(e) => setVenture(e.target.value)}
              error={errors.venture}
              hint="A working name is fine."
              maxLength={200}
            />
          )}
          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? 'Setting up…' : 'Get started'}
          </Button>
        </form>
        {!hasVenture && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[13px] text-muted-foreground">Moving computers or picking up a venture from a teammate?</p>
            <Button variant="secondary" className="mt-2 w-full" onClick={onImport} disabled={busy}>
              <FileUp aria-hidden strokeWidth={1.5} />
              Import workspace
            </Button>
          </div>
        )}
      </Card>
    </main>
  )
}
