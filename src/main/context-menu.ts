import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron'

/** The right-click menu for text: spelling suggestions, then Cut/Copy/Paste/Select all. Empty when there is no text to act on. */
export function contextMenuTemplate(
  p: Pick<ContextMenuParams, 'isEditable' | 'selectionText' | 'misspelledWord' | 'dictionarySuggestions' | 'editFlags'>,
  wc: Pick<WebContents, 'replaceMisspelling' | 'session'>
): MenuItemConstructorOptions[] {
  if (!p.isEditable) return p.selectionText.trim() ? [{ role: 'copy', enabled: p.editFlags.canCopy }] : []
  const spelling: MenuItemConstructorOptions[] = p.misspelledWord
    ? [
        ...(p.dictionarySuggestions.length
          ? p.dictionarySuggestions.map((word) => ({ label: word, click: () => wc.replaceMisspelling(word) }))
          : [{ label: 'No suggestions', enabled: false }]),
        { label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
        { type: 'separator' }
      ]
    : []
  return [
    ...spelling,
    { role: 'cut', enabled: p.editFlags.canCut },
    { role: 'copy', enabled: p.editFlags.canCopy },
    { role: 'paste', enabled: p.editFlags.canPaste },
    { type: 'separator' },
    { role: 'selectAll', enabled: p.editFlags.canSelectAll }
  ]
}
