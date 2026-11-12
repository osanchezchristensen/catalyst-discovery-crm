// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => Object.defineProperty(window, 'api', { value: {}, configurable: true }))
import App from './App'
import type { Editor } from '@tiptap/react'
import { contact, hypothesis, insight, installFakeApi } from './test-api'

// jsdom has no layout; ProseMirror asks for caret rectangles when it scrolls the selection into view.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
Range.prototype.getClientRects ??= noRects
Range.prototype.getBoundingClientRect ??= () => new DOMRect()

// TipTap puts its editor on the editable element; tests drive it directly because jsdom can't type into contenteditable.
const editorOf = (el: HTMLElement) => (el as HTMLElement & { editor: Editor }).editor
const write = (el: HTMLElement, html: string) => act(() => void editorOf(el).commands.setContent(html))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function openNewInterview(type: string | null = 'validation') {
  // Fake timers from the start so the editor's autosave interval is under test control; time still flows for findBy*.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Log interview' }))
  const pains = await screen.findByLabelText('Pains')
  if (type) fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: type } })
  return pains
}

describe('interview editor inside the app', () => {
  it('keeps typed text and autosaves it after 5 seconds (Phase 2 regression)', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview()
    await write(pains, '<p>Food arrives cold</p>')
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.getByLabelText('Pains').textContent).toBe('Food arrives cold')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview).toHaveBeenCalledTimes(1)
    expect(api.saveInterview.mock.calls[0][0].notes.pains).toBe('<p>Food arrives cold</p>')
  })

  it('does not save a new interview until a type is chosen, and says why', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview(null)
    await write(pains, '<p>Food arrives cold</p>')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview).not.toHaveBeenCalled()
    expect(await screen.findByText('Choose an interview type')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'informational' } })
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview.mock.calls[0][0].type).toBe('informational')
  })

  it('sends the evidence verdict picked for a hypothesis with the next save', async () => {
    const api = installFakeApi({ hypotheses: [hypothesis] })
    const pains = await openNewInterview()
    fireEvent.click(await screen.findByRole('radio', { name: 'Refutes' }))
    await write(pains, '<p>They eat in the dining hall</p>')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview.mock.calls[0][0].evidence).toEqual([{ hypothesis_id: hypothesis.id, verdict: 'refutes', note: '' }])
  })

  it('saves highlighted note text as a tagged insight for this interview', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview()
    await write(pains, '<p>Food is <strong>always</strong> cold by midnight</p>')
    await act(() => vi.advanceTimersByTimeAsync(5000)) // autosave creates the interview
    await act(() => void editorOf(pains).commands.setTextSelection({ from: 1, to: 20 })) // insights get the text, not the tags
    fireEvent.click(await screen.findByRole('button', { name: 'Save highlighted text as insight' }))
    expect(await screen.findByLabelText('Insight')).toHaveProperty('value', 'Food is always cold')
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Cold, delivery, cold' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save insight' }))
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(api.saveInsight).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Food is always cold', tags: ['cold', 'delivery'], interview_id: '00000000-0000-4000-8000-000000000001', is_quote: false })
    )
  })

  it('says which note is too long when autosave refuses it', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview()
    await write(pains, `<p>${'x'.repeat(50_001)}</p>`)
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview).not.toHaveBeenCalled()
    expect(await screen.findByText(/This note is too long/)).toBeTruthy()
    expect(screen.getByLabelText('Pains').getAttribute('aria-invalid')).toBe('true')
  })

  it('formats notes from the toolbar and keeps only toolbar formatting from a paste', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview()
    await write(pains, '<p>Cold food</p>')
    await act(() => void editorOf(pains).commands.selectAll())
    const toolbar = within(screen.getByRole('toolbar', { name: 'Pains formatting' }))
    const bold = toolbar.getByRole('button', { name: 'Bold' })
    fireEvent.click(bold)
    expect(bold.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(toolbar.getByRole('button', { name: 'Bullet list' }))
    // What a paste from a web page or Word looks like once parsed: links, images, spans and tables must go.
    await act(
      () =>
        void editorOf(pains)
          .chain()
          .focus('end')
          .insertContent('<p><a href="https://x.com">See</a> <span style="color:red">red</span> <u>under</u> <img src="x.png"></p><table><tr><td>cell</td></tr></table>')
          .run()
    )
    await act(() => vi.advanceTimersByTimeAsync(5000))
    const saved = api.saveInterview.mock.calls[0][0].notes.pains
    expect(saved).toContain('<ul><li><p><strong>Cold food</strong>')
    expect(saved).toContain('<u>under</u>')
    expect(saved).toContain('cell')
    expect(saved).not.toMatch(/<(a|img|span|table|td)\b|style=|href=/)
  })
})

describe('referrals and tags', () => {
  it('adds someone the interviewee suggested as a contact referred by them', async () => {
    const pat = contact('00000000-0000-4000-8000-0000000000aa', 'Pat')
    const api = installFakeApi({ contacts: [pat] })
    await openNewInterview()
    fireEvent.change(await screen.findByLabelText('Contact'), { target: { value: pat.id } })
    fireEvent.change(await screen.findByLabelText('Who did they suggest?'), { target: { value: 'Maya' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add referral' }))
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(api.saveContact).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maya', referred_by: pat.id, stage: 'identified' }))
    expect(await screen.findByText('Added Maya, referred by Pat.')).toBeTruthy()
  })

  it('merges one insight tag into another from the tag manager', async () => {
    const api = installFakeApi({ insights: [insight('n1', 'Too pricey', ['price']), insight('n2', 'Pricing page', ['pricing'])] })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Insights' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Manage tags' }))
    fireEvent.change(screen.getByLabelText(/Rename “price”/), { target: { value: 'Pricing' } })
    expect(screen.getByText('Merges into the existing tag “pricing”.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    await act(async () => {})
    expect(api.renameTag).toHaveBeenCalledWith({ from: 'price', to: 'pricing' })
  })
})
