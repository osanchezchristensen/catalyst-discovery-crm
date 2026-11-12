import { describe, expect, it } from 'vitest'
import { search, type Searchable } from './search'

const data: Searchable = {
  contacts: [
    { id: 'c1', name: 'José Martínez', organization: 'Dining Services', role: 'Manager', email: 'jose@ku.edu', tags: ['staff'], notes: '' },
    { id: 'c2', name: 'Maya Lee', organization: '', role: '', email: '', tags: [], notes: 'Met at the career fair' }
  ],
  interviews: [
    {
      id: 'i1', contact_name: 'Maya Lee', date: '2026-11-03', quotes: '', next_step: '', wtp_signal: '',
      notes: { behavior: '<p>She drives to campus and <strong>parking</strong> takes 20 minutes every morning before class.</p>', pains: '', solutions: '', budget: '' }
    }
  ],
  insights: [{ id: 'n1', interview_id: 'i1', text: 'Parking is the worst part of the day', tags: ['commute'] }],
  hypotheses: [{ id: 'h1', statement: 'Commuters will pay for reserved parking', success_criteria: '3 pre-orders' }]
}

describe('search', () => {
  it('ignores case and accents and finds every kind of record', () => {
    const groups = search('PARKING', data)
    expect(groups.map((g) => [g.kind, g.total])).toEqual([
      ['interviews', 1],
      ['insights', 1],
      ['hypotheses', 1]
    ])
    expect(search('jose martinez', data)[0].hits[0]).toMatchObject({ id: 'c1', title: 'José Martínez' })
  })

  it('needs every word somewhere in the record', () => {
    expect(search('maya fair', data).map((g) => g.kind)).toEqual(['contacts'])
    expect(search('maya banana', data)).toEqual([])
  })

  it('shows a snippet around the match, from note text but not from HTML tags', () => {
    const hit = search('parking', data)[0].hits[0]
    expect(hit.detail).toContain('parking takes 20 minutes')
    expect(hit.detail).not.toContain('<')
    expect(search('strong', data)).toEqual([])
    // Accents before the match (here written as letter + combining mark) must not shift the snippet.
    const accented: Searchable = { ...data, contacts: [{ ...data.contacts[1], notes: `Jose${'́'.repeat(30)} said the bus is late` }] }
    expect(search('bus', accented)[0].hits[0].detail).toContain('bus is late')
  })

  it('caps each group but reports the total, and an empty query finds nothing', () => {
    const many: Searchable = { ...data, contacts: Array.from({ length: 12 }, (_, k) => ({ ...data.contacts[1], id: `c${k}`, name: `Maya ${k}` })) }
    const [contacts] = search('maya', many)
    expect(contacts.hits).toHaveLength(8)
    expect(contacts.total).toBe(12)
    expect(search('   ', data)).toEqual([])
  })
})
