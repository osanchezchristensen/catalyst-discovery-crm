import { cn } from '@/lib/utils'

/** Text-only wordmark. Never replace with the Jayhawk or KU signature (brand kit). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div translate="no" className={cn('leading-tight', className)}>
      <span className="block font-heading text-2xl font-semibold">The Catalyst</span>
      <span className="block text-[13px] font-semibold tracking-wide uppercase">Discovery CRM</span>
    </div>
  )
}
