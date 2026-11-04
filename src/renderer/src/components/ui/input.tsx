import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Errors use a heavier Night border plus an icon and text; Crimson is reserved for destructive actions.
const field =
  'w-full rounded-md border border-input bg-card px-3 text-[15px] text-foreground transition-colors duration-150 ease-out placeholder:text-muted-foreground hover:border-muted-foreground disabled:cursor-not-allowed disabled:bg-background aria-invalid:border-2 aria-invalid:border-foreground'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input autoComplete="off" className={cn(field, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'min-h-24 py-2', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, 'h-9', className)} {...props} />
}
