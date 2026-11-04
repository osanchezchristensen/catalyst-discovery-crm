import { CircleCheck, CircleDashed, CircleX, FlaskConical, Scale, type LucideIcon } from 'lucide-react'
import type { HypothesisStatus } from '../../../shared/evidence'
import { STATUS_LABELS } from '@/lib/discovery'
import { cn } from '@/lib/utils'

// Brand kit pairs: Night on Steam, Night on Sky, white on KU Blue, Night on Gold; Crimson marks invalidated.
const STYLE: Record<HypothesisStatus, { icon: LucideIcon; className: string }> = {
  untested: { icon: CircleDashed, className: 'bg-secondary text-secondary-foreground' },
  testing: { icon: FlaskConical, className: 'bg-accent text-accent-foreground' },
  validated: { icon: CircleCheck, className: 'bg-primary text-primary-foreground' },
  mixed: { icon: Scale, className: 'bg-warning text-warning-foreground' },
  invalidated: { icon: CircleX, className: 'bg-destructive text-destructive-foreground' }
}

/** Status is always an icon plus a word, never color alone. */
export function StatusChip({ status }: { status: HypothesisStatus }) {
  const { icon: Icon, className } = STYLE[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold', className)}>
      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}
