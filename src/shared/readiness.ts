// The PRD readiness checklist (drives the viability dashboard). Pure, so it is easy to test.
import type { Tally } from './evidence'
import type { Thresholds } from './schema'

/** PRD defaults; a cohort can override them in Settings (stored in cohorts.settings.readiness). */
export const DEFAULT_THRESHOLDS: Thresholds = {
  segments: 3,
  beachheadInterviews: 10,
  riskiest: 3,
  interviewsPerHypothesis: 5,
  painScore: 4,
  painShare: 0.6,
  wtpSignals: 3
}

export type ReadinessInput = {
  segments: { id: string; is_beachhead: boolean }[]
  interviews: { segment_id: string | null; pain_score: number | null; wtp_signal: string }[]
  hypotheses: { risk: 'low' | 'medium' | 'high'; created_at: string; tally: Tally }[]
  decisions: { rationale: string }[]
}

export type ReadinessItem = { key: string; label: string; done: boolean; progress: string }

const RISK_ORDER = { high: 0, medium: 1, low: 2 }
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
/** "7 of 10" below the goal, "11 (goal: 10)" past it. */
const ofGoal = (n: number, goal: number) => (n < goal ? `${n} of ${goal}` : `${n} (goal: ${goal})`)

export function readiness(
  { segments, interviews, hypotheses, decisions }: ReadinessInput,
  T: Thresholds = DEFAULT_THRESHOLDS
): ReadinessItem[] {
  const beachhead = segments.find((s) => s.is_beachhead)
  const inBeachhead = beachhead ? interviews.filter((i) => i.segment_id === beachhead.id) : []
  const painful = inBeachhead.filter((i) => (i.pain_score ?? 0) >= T.painScore).length
  const riskiest = [...hypotheses]
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.created_at.localeCompare(b.created_at))
    .slice(0, T.riskiest)
  const covered = riskiest.filter((h) => h.tally.supports + h.tally.refutes + h.tally.neutral >= T.interviewsPerHypothesis).length
  const wtp = interviews.filter((i) => i.wtp_signal.trim()).length
  const decided = decisions.some((d) => d.rationale.trim())

  return [
    {
      key: 'segments',
      label: `${T.segments}+ customer segments identified, one chosen as the beachhead`,
      done: segments.length >= T.segments && !!beachhead,
      progress: `${plural(segments.length, 'segment')}, ${beachhead ? 'beachhead chosen' : 'no beachhead yet'}`
    },
    {
      key: 'beachhead-interviews',
      label: `${T.beachheadInterviews}+ interviews logged in the beachhead segment`,
      done: inBeachhead.length >= T.beachheadInterviews,
      progress: beachhead ? `${ofGoal(inBeachhead.length, T.beachheadInterviews)} beachhead interviews` : 'Choose a beachhead segment first'
    },
    {
      key: 'riskiest',
      label: `Top ${T.riskiest} riskiest hypotheses each have ${T.interviewsPerHypothesis}+ linked interviews`,
      done: riskiest.length >= T.riskiest && covered === riskiest.length,
      progress:
        hypotheses.length < T.riskiest
          ? `Only ${hypotheses.length} ${hypotheses.length === 1 ? 'hypothesis' : 'hypotheses'} so far`
          : `${covered} of ${T.riskiest} have ${T.interviewsPerHypothesis}+ interviews`
    },
    {
      key: 'pain',
      label: `A pain scored ${T.painScore}+ in at least ${T.painShare * 100}% of beachhead interviews`,
      // Division, not painShare * n: 0.6 * 5 is 3.0000000000000004 in floating point.
      done: inBeachhead.length > 0 && painful / inBeachhead.length >= T.painShare,
      progress: inBeachhead.length
        ? `${Math.round((painful / inBeachhead.length) * 100)}% of beachhead interviews scored ${T.painScore}+`
        : 'No beachhead interviews yet'
    },
    {
      key: 'wtp',
      label: `At least ${T.wtpSignals} interviews show a willingness-to-pay or commitment signal`,
      done: wtp >= T.wtpSignals,
      progress: `${ofGoal(wtp, T.wtpSignals)} interviews with a signal`
    },
    {
      key: 'decision',
      label: 'Decision recorded with rationale',
      done: decided,
      progress: decided ? 'Recorded' : 'No decision yet'
    }
  ]
}
