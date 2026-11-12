// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrashItem } from '../../../shared/schema'
import { TrashCard } from './TrashCard'

afterEach(cleanup)

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 60_000).toISOString()

describe('trash card', () => {
  it('lists items with days left, and restores one', async () => {
    const items: TrashItem[] = [
      { kind: 'contact', id: 'c1', name: 'Pat', date: null, deleted_at: daysAgo(0) },
      { kind: 'interview', id: 'i1', name: null, date: '2026-11-03', deleted_at: daysAgo(29) }
    ]
    const restoreFromTrash = vi.fn(async () => {})
    Object.defineProperty(window, 'api', { value: { listTrash: vi.fn(async () => items), restoreFromTrash }, configurable: true })
    const onNotify = vi.fn()
    render(<TrashCard onNotify={onNotify} onError={(e) => { throw e }} />)
    expect(await screen.findByText(/30/)).toBeTruthy()
    expect(screen.getByText(/Interview with no contact/)).toBeTruthy()
    expect(screen.getByText('1').parentElement?.textContent).toMatch(/1 day left/)
    fireEvent.click(screen.getByRole('button', { name: 'Restore Pat' }))
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('Pat restored'))
    expect(restoreFromTrash).toHaveBeenCalledWith({ kind: 'contact', id: 'c1' })
    expect(screen.queryByText('Pat')).toBeNull()
  })
})
