// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResetDialog } from './Settings'

afterEach(cleanup)

describe('reset workspace dialog', () => {
  it('stays disabled until the venture name is typed, then resets', async () => {
    const resetWorkspace = vi.fn(async () => ({ backup: 'pre-reset.sqlite' }))
    Object.defineProperty(window, 'api', { value: { resetWorkspace }, configurable: true })
    render(<ResetDialog ventureName="Campus Eats" onClose={() => {}} onError={(e) => { throw e }} />)
    const button = screen.getByRole('button', { name: 'Delete everything and reset' }) as HTMLButtonElement
    const input = screen.getByLabelText('Type "Campus Eats" to confirm')
    expect(button.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Campus' } })
    expect(button.disabled).toBe(true)
    fireEvent.change(input, { target: { value: ' campus eats ' } })
    expect(button.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(button)
    })
    expect(resetWorkspace).toHaveBeenCalledWith(' campus eats ')
  })
})
