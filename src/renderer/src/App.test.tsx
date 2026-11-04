// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => Object.defineProperty(window, 'api', { value: {}, configurable: true }))
import App from './App'
import { hypothesis, installFakeApi } from './test-api'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function openNewInterview() {
  // Fake timers from the start so the editor's autosave interval is under test control; time still flows for findBy*.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Log interview' }))
  return screen.findByLabelText('Pains')
}

describe('interview editor inside the app', () => {
  it('keeps typed text and autosaves it after 5 seconds (Phase 2 regression)', async () => {
    const api = installFakeApi()
    const pains = await openNewInterview()
    fireEvent.change(pains, { target: { value: 'Food arrives cold' } })
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.getByLabelText('Pains')).toHaveProperty('value', 'Food arrives cold')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview).toHaveBeenCalledTimes(1)
    expect(api.saveInterview.mock.calls[0][0].notes.pains).toBe('Food arrives cold')
  })

  it('sends the evidence verdict picked for a hypothesis with the next save', async () => {
    const api = installFakeApi({ hypotheses: [hypothesis] })
    const pains = await openNewInterview()
    fireEvent.click(await screen.findByRole('radio', { name: 'Refutes' }))
    fireEvent.change(pains, { target: { value: 'They eat in the dining hall' } })
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(api.saveInterview.mock.calls[0][0].evidence).toEqual([{ hypothesis_id: hypothesis.id, verdict: 'refutes', note: '' }])
  })
})
