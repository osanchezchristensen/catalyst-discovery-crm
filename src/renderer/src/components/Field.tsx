import { AlertCircle } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Input, Select, Textarea } from './ui/input'

type Common = { label: string; error?: string; hint?: string; hideLabel?: boolean }

function Wrapper({ id, label, error, hint, hideLabel, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[13px] font-semibold'}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-[13px] font-semibold">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

function useFieldIds(c: Common) {
  const id = useId()
  const describedBy = c.error ? `${id}-error` : c.hint ? `${id}-hint` : undefined
  return { id, aria: { id, 'aria-invalid': c.error ? true : undefined, 'aria-describedby': describedBy } }
}

export function TextField({ label, error, hint, hideLabel, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const { id, aria } = useFieldIds({ label, error, hint })
  return (
    <Wrapper {...{ id, label, error, hint, hideLabel }}>
      <Input {...aria} {...props} />
    </Wrapper>
  )
}

export function TextAreaField({ label, error, hint, hideLabel, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, aria } = useFieldIds({ label, error, hint })
  return (
    <Wrapper {...{ id, label, error, hint, hideLabel }}>
      <Textarea {...aria} {...props} />
    </Wrapper>
  )
}

export function SelectField({ label, error, hint, hideLabel, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const { id, aria } = useFieldIds({ label, error, hint })
  return (
    <Wrapper {...{ id, label, error, hint, hideLabel }}>
      <Select {...aria} {...props} />
    </Wrapper>
  )
}

export const STAGE_OPTIONS = [
  { value: 1, label: 'Stage 1: Founder' },
  { value: 2, label: 'Stage 2: Guide in Training' },
  { value: 3, label: 'Stage 3: Guide' }
]
