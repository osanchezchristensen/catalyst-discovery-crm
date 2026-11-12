// Pattern finders for the Patterns screen (backlog #11). Pure, so they are easy to test.

type Person = { id: string; name: string; organization: string; referred_by: string | null }
export type ReferralNode<P extends Person = Person> = { contact: P; interviewed: boolean; children: ReferralNode<P>[] }

/**
 * Who referred whom, as trees rooted at people with no (known) referrer who referred someone.
 * A visited set means a loop carried in by an imported file is shown once instead of forever.
 */
export function referralChains<P extends Person>(contacts: P[], interviews: { contact_id: string | null }[]): ReferralNode<P>[] {
  const ids = new Set(contacts.map((c) => c.id))
  const interviewed = new Set(interviews.map((i) => i.contact_id))
  const referred = new Map<string, P[]>()
  for (const c of contacts) {
    if (c.referred_by && ids.has(c.referred_by)) referred.set(c.referred_by, [...(referred.get(c.referred_by) ?? []), c])
  }
  const seen = new Set<string>()
  const node = (c: P): ReferralNode<P> => {
    seen.add(c.id)
    const children = (referred.get(c.id) ?? []).filter((k) => !seen.has(k.id)).map(node)
    return { contact: c, interviewed: interviewed.has(c.id), children }
  }
  const isRoot = (c: P) => !c.referred_by || !ids.has(c.referred_by)
  // Real roots first; then anyone left over in a loop, so every referral still shows up somewhere.
  const trees: ReferralNode<P>[] = []
  for (const c of [...contacts.filter(isRoot), ...contacts.filter((c) => !isRoot(c))]) {
    if (!seen.has(c.id) && referred.has(c.id)) trees.push(node(c)) // checked as we go: earlier trees mark people seen
  }
  return trees
}

type InterviewLike = { id: string; type: string; pain_score: number | null; wtp_signal: string; date: string; contact_name: string | null }
type InsightLike = { id: string; interview_id: string | null; text: string; is_quote: boolean; date: string | null; contact_name: string | null }

export type TypeSummary<I extends InterviewLike = InterviewLike, Q extends InsightLike = InsightLike> = {
  count: number
  rated: number
  avgPain: number | null
  /** How many interviews scored pain 1 to 5 (index 0 is a score of 1). */
  pain: number[]
  signals: I[]
  quotes: Q[]
}

const MAX_QUOTES = 5

/** Validation interviews next to Sales ones: pain, buying signals and their newest quotes. */
export function compareByType<I extends InterviewLike, Q extends InsightLike>(
  interviews: I[],
  insights: Q[]
): { validation: TypeSummary<I, Q>; sales: TypeSummary<I, Q> } {
  const summary = (type: string): TypeSummary<I, Q> => {
    const mine = interviews.filter((i) => i.type === type)
    const ids = new Set(mine.map((i) => i.id))
    const scores = mine.map((i) => i.pain_score).filter((s): s is number => s !== null)
    return {
      count: mine.length,
      rated: scores.length,
      avgPain: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      pain: [1, 2, 3, 4, 5].map((s) => scores.filter((x) => x === s).length),
      signals: mine.filter((i) => i.wtp_signal.trim()),
      quotes: insights
        .filter((n) => n.is_quote && n.interview_id && ids.has(n.interview_id))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        .slice(0, MAX_QUOTES)
    }
  }
  return { validation: summary('validation'), sales: summary('sales') }
}
