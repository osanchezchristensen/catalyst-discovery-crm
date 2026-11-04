// Interview guide helpers (F9): a bank of past-behavior questions and a checker for risky wording.

/** Questions about what people actually did, which predict behavior better than opinions do. */
export const QUESTION_BANK = [
  'Tell me about your role and what a typical week looks like.',
  'Tell me about the last time [the problem] happened.',
  'Walk me through how you handle [the problem] today.',
  'What was the hardest part about that?',
  'Why was that hard?',
  'What, if anything, have you tried to solve it?',
  "What don't you love about the solutions you've tried?",
  'How much time or money did that cost you last time?',
  'When did you last spend money on this problem?',
  'Who else is involved when this happens?',
  'How often does this come up?',
  'What happened the last time it went wrong?',
  'What do you use today, and how did you choose it?',
  'How do you decide what to spend on this?',
  'Where do you go to look for help when this happens?',
  'What did you do right after that happened?',
  'What makes this a priority for you right now, or not?',
  'Who else should I talk to about this?',
  'What else should I have asked?'
] as const

export type QuestionTip = { key: 'yes-no' | 'hypothetical' | 'leading'; tip: string }

const TIPS: Record<QuestionTip['key'], string> = {
  'yes-no': 'Yes/no questions invite polite answers. Try "Tell me about the last time…" instead.',
  hypothetical: 'Answers about the future are unreliable. Ask what they did the last time instead.',
  leading: 'This hints at the answer you want. Ask it neutrally.'
}

// "Can you walk me through…" style openers are invitations to tell a story, not yes/no questions.
const STORY_OPENER = /^(can|could|would|will) you (please )?(walk|tell|show|describe|take|share|explain)\b/i
const YES_NO = /^(do|does|did|would|will|is|are|was|were|can|could|should|have|has|had)\b/i
const HYPOTHETICAL = /\b(would you|will you|if (we|you|there) (built|made|offered|had|could)|imagine)\b/i
// ['’]? also matches curly apostrophes pasted from Word or Google Docs.
const LEADING = /\b(don['’]?t you think|wouldn['’]?t you agree|isn['’]?t it|aren['’]?t you|wouldn['’]?t it be|you['’]?d agree|how much would you love)\b/i

/** Coaching tips for a draft interview question; an empty list means it reads well. */
export function questionTips(question: string): QuestionTip[] {
  const q = question.trim()
  if (!q) return []
  const story = STORY_OPENER.test(q)
  const found: QuestionTip['key'][] = []
  if (!story && YES_NO.test(q)) found.push('yes-no')
  if (!story && HYPOTHETICAL.test(q)) found.push('hypothetical')
  if (LEADING.test(q)) found.push('leading')
  return found.map((key) => ({ key, tip: TIPS[key] }))
}
