import { describe, expect, it } from 'vitest'
import { cleanNoteHtml, noteToPlain, plainToHtml } from './notes'

describe('cleanNoteHtml', () => {
  it('keeps the toolbar tags and drops their attributes', () => {
    expect(cleanNoteHtml('<p class="x"><strong>Late</strong> and <u style="color:red">cold</u></p><ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>')).toBe(
      '<p><strong>Late</strong> and <u>cold</u></p><ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>'
    )
  })

  it('drops scripts, handlers, links, images, spans and italics', () => {
    expect(cleanNoteHtml('<p onclick="x()">hi<script>bad()</script></p>')).toBe('<p>hibad()</p>')
    expect(cleanNoteHtml('<img src=x onerror=alert(1)><a href="https://x.com">link</a><span style="font:9px">s</span><em>e</em>')).toBe('linkse')
    expect(cleanNoteHtml('<P>Upper</P><o:p></o:p>')).toBe('<p>Upper</p>')
  })

  it('escapes stray angle brackets and bare ampersands but keeps entities', () => {
    expect(cleanNoteHtml('<p>a < b & c &amp; d > e &#39;</p>')).toBe('<p>a &lt; b &amp; c &amp; d &gt; e &#39;</p>')
    expect(cleanNoteHtml('<p>unclosed <script')).toBe('<p>unclosed &lt;script')
  })
})

describe('plainToHtml', () => {
  it('makes one escaped paragraph per line and leaves empty notes empty', () => {
    expect(plainToHtml('line1\nline2 <b> & co')).toBe('<p>line1</p><p>line2 &lt;b&gt; &amp; co</p>')
    expect(plainToHtml('a\r\n\r\nb')).toBe('<p>a</p><p></p><p>b</p>')
    expect(plainToHtml('')).toBe('')
  })
})

describe('noteToPlain', () => {
  it('turns lists into • and numbered lines and decodes entities', () => {
    expect(noteToPlain('<p>Intro &amp; more</p><ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li><li><p>second</p></li></ol>')).toBe(
      'Intro & more\n• one\n• two\n1. first\n2. second'
    )
  })

  it('handles nested lists and round-trips plain text', () => {
    expect(noteToPlain('<ul><li><p>a</p><ol><li><p>b</p></li></ol></li></ul>')).toBe('• a\n  1. b')
    expect(noteToPlain(plainToHtml('x < y\n\nz'))).toBe('x < y\n\nz')
    expect(noteToPlain('')).toBe('')
    expect(noteToPlain('<ul><li><p>a</p></li></ul><p>after</p>')).toBe('• a\nafter')
    expect(noteToPlain('<p>loose</p>text outside')).toBe('loose\ntext outside')
  })
})
