import { describe, expect, it } from 'vitest'
import { QUESTION_BANK, questionTips } from './guides'

const keys = (q: string) => questionTips(q).map((t) => t.key)

describe('questionTips', () => {
  it('flags yes/no, hypothetical and leading wording', () => {
    expect(keys('Would you buy this?')).toEqual(['yes-no', 'hypothetical'])
    expect(keys('Do you like the idea?')).toEqual(['yes-no'])
    expect(keys('How much would you pay for it?')).toEqual(['hypothetical'])
    expect(keys('What if we built an app for that? Imagine it.')).toEqual(['hypothetical'])
    expect(keys("Don't you think that's a pain?")).toEqual(['leading'])
    expect(keys('Don’t you think so?')).toEqual(['leading']) // curly apostrophe
    expect(keys("It's frustrating, isn't it?")).toEqual(['leading'])
  })

  it('lets story openers and past-behavior questions through', () => {
    expect(keys('Can you walk me through your morning?')).toEqual([])
    expect(keys('Could you tell me about the last time it broke?')).toEqual([])
    expect(keys('What did you do after that?')).toEqual([])
    expect(keys('   ')).toEqual([])
  })

  it('has no flags on any question in the bank', () => {
    for (const q of QUESTION_BANK) expect(keys(q), q).toEqual([])
  })
})
