import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import { UndoRedo } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { Bold as BoldIcon, List, ListOrdered, Underline as UnderlineIcon, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

// Only what the toolbar makes (ADR 0006). With no other nodes or marks in the schema, a paste from Word, Google Docs
// or the web keeps bold, underline, lists and paragraphs and drops fonts, colors, images, tables and links (backlog #2).
const EXTENSIONS = [Document, Paragraph, Text, Bold, Underline, BulletList, OrderedList, ListItem, ListKeymap, UndoRedo]

type Tool = { name: string; shortcut: string; icon: LucideIcon; active: (e: Editor) => boolean; run: (e: Editor) => void }
const TOOLS: Tool[] = [
  { name: 'Bold', shortcut: 'Ctrl+B', icon: BoldIcon, active: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { name: 'Underline', shortcut: 'Ctrl+U', icon: UnderlineIcon, active: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { name: 'Bullet list', shortcut: 'Ctrl+Shift+8', icon: List, active: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { name: 'Numbered list', shortcut: 'Ctrl+Shift+7', icon: ListOrdered, active: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() }
]

const html = (e: Editor) => (e.isEmpty ? '' : e.getHTML())

/** A notes box with a bold, underline and list toolbar. `value` and `onChange` carry note HTML ('' when empty). */
export function NotesEditor({
  label,
  hint,
  value,
  onChange,
  onSelectText
}: {
  label: string
  hint?: string
  value: string
  onChange: (html: string) => void
  onSelectText?: (text: string) => void
}) {
  const id = useId()
  const emitted = useRef(value) // what the editor last sent up, so echoes of our own changes don't reset the caret
  const callbacks = useRef({ onChange, onSelectText })
  useEffect(() => {
    callbacks.current = { onChange, onSelectText }
  })

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    injectCSS: false, // the few rules it needs live in index.css, next to the tokens
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': `${id}-label`,
        ...(hint ? { 'aria-describedby': `${id}-hint` } : {}),
        class: 'notes-editor min-h-24 px-3 py-2 outline-none'
      }
    },
    onUpdate: ({ editor: e }) => {
      emitted.current = html(e)
      callbacks.current.onChange(emitted.current)
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection
      const text = e.state.doc.textBetween(from, to, '\n').trim()
      if (text) callbacks.current.onSelectText?.(text)
    }
  })

  // Load a different value from outside (opening an interview) without echoing it back as an edit.
  useEffect(() => {
    if (editor && value !== emitted.current) {
      emitted.current = value
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  const active = useEditorState({ editor, selector: ({ editor: e }) => (e ? TOOLS.map((t) => t.active(e)) : TOOLS.map(() => false)) })

  // One tab stop for the toolbar; arrow keys move between its buttons.
  const [focused, setFocused] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const onToolbarKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (focused + step + TOOLS.length) % TOOLS.length
    setFocused(next)
    buttons.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className="text-[13px] font-semibold">
        {label}
      </span>
      <div className="rounded-md border border-input bg-card transition-colors duration-150 ease-out focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:border-muted-foreground">
        <div role="toolbar" aria-label={`${label} formatting`} className="flex gap-1 border-b border-input p-1" onKeyDown={onToolbarKey}>
          {TOOLS.map((t, i) => (
            <button
              key={t.name}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              tabIndex={i === focused ? 0 : -1}
              aria-pressed={active[i]}
              title={`${t.name} (${t.shortcut})`}
              disabled={!editor}
              onFocus={() => setFocused(i)}
              onClick={() => editor && t.run(editor)}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-sm text-foreground hover:bg-secondary disabled:opacity-50',
                active[i] && 'bg-secondary text-primary ring-1 ring-primary'
              )}
            >
              <t.icon className="size-4" strokeWidth={active[i] ? 2.25 : 1.5} aria-hidden />
              <span className="sr-only">{t.name}</span>
            </button>
          ))}
        </div>
        <EditorContent editor={editor} className="text-[15px] text-foreground" />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
