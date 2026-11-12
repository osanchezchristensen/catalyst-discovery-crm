import { describe, expect, it, vi } from 'vitest'
import { contextMenuTemplate } from './context-menu'

const flags = { canCut: true, canCopy: true, canPaste: true, canSelectAll: true, canUndo: false, canRedo: false, canDelete: false, canEditRichly: false }
const params = (over = {}) => ({ isEditable: true, selectionText: '', misspelledWord: '', dictionarySuggestions: [], editFlags: flags, ...over })
const wc = () => ({ replaceMisspelling: vi.fn(), session: { addWordToSpellCheckerDictionary: vi.fn() } })

describe('contextMenuTemplate', () => {
  it('offers spelling suggestions and edit actions in a misspelled text field', () => {
    const w = wc()
    const items = contextMenuTemplate(params({ misspelledWord: 'pian', dictionarySuggestions: ['pain', 'pan'] }), w as never)
    expect(items.map((i) => i.label ?? i.role ?? i.type)).toEqual(['pain', 'pan', 'Add to dictionary', 'separator', 'cut', 'copy', 'paste', 'separator', 'selectAll'])
    items[0].click!({} as never, undefined, {} as never)
    expect(w.replaceMisspelling).toHaveBeenCalledWith('pain')
    items[2].click!({} as never, undefined, {} as never)
    expect(w.session.addWordToSpellCheckerDictionary).toHaveBeenCalledWith('pian')
  })

  it('says when there are no suggestions', () => {
    expect(contextMenuTemplate(params({ misspelledWord: 'zxq' }), wc() as never)[0]).toEqual({ label: 'No suggestions', enabled: false })
  })

  it('offers only Copy for selected read-only text, and nothing otherwise', () => {
    expect(contextMenuTemplate(params({ isEditable: false, selectionText: 'Too slow' }), wc() as never)).toEqual([{ role: 'copy', enabled: true }])
    expect(contextMenuTemplate(params({ isEditable: false }), wc() as never)).toEqual([])
  })
})
