// The evidence rule shared by main (list results) and renderer (cards).
import type { HYPOTHESIS_STATUSES } from './schema'

export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number]
export type Tally = { supports: number; refutes: number; neutral: number }

/** Decisive (Supports or Refutes) interviews needed before evidence can settle a hypothesis (matches the readiness checklist). */
export const MIN_INTERVIEWS = 5
/** Share of supports (or refutes) among non-neutral verdicts that settles it. */
export const DECISIVE_SHARE = 0.7

/**
 * Suggested status from an evidence tally. Only Supports and Refutes count toward the
 * minimum and the share; Neutral verdicts never settle anything. Students can always
 * override the status by hand.
 */
export function suggestStatus({ supports, refutes, neutral }: Tally): HypothesisStatus {
  if (supports + refutes + neutral === 0) return 'untested'
  const decided = supports + refutes
  if (decided < MIN_INTERVIEWS) return 'testing'
  if (supports / decided >= DECISIVE_SHARE) return 'validated'
  if (refutes / decided >= DECISIVE_SHARE) return 'invalidated'
  return 'mixed'
}
