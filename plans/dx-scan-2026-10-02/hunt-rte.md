# hunt-rte — bug hunt 2026-10-10

Scope: `libs/components/src/lib/forms/rich-text-editor`, `forms/multi-language-rich-text-editor` (and the
`htmlToMarkdown` / `markdownToHtml` pair in `libs/core/src/lib/utils/markdown.ts` they serialize through).
Read-only hunt; findings already in `rte.md` (RTE-01..16) are not repeated. The markdown results below were
run with `npx tsx` against the real `markdown.ts`.

| ID    | Sev    | Kind | Decision | Title                                                                                                   |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------------------- |
| HR-01 | High   | bug  | no       | An empty heading or list item serializes to `#` / `-` / `1.`, which reads back as a literal paragraph   |
| HR-02 | High   | bug  | no       | Pasting `text-align: -webkit-center` (any non-word value) shows the paragraph's raw HTML as text        |
| HR-03 | Medium | bug  | yes      | Pasted `text-align: left/start/inherit` is stored as raw HTML, with or without the alignment tool       |
| HR-04 | Medium | bug  | no       | IME / composition input: pending marks and autoformat never apply; Enter during composition is hijacked |
| HR-05 | Low    | bug  | no       | A programmatic value write keeps pending marks and stale toolbar state                                  |
| HR-06 | Low    | bug  | no       | `requiredLanguages` throws on a `null` record, which the editor itself accepts                          |

## HR-01 An empty heading or list item serializes to `#` / `-` / `1.`, which reads back as a literal paragraph

Status: fixed (empty headings/list items drop out of htmlToMarkdown; an undo back to the empty state renders an empty paragraph, since the value cannot express an empty heading)

- Where: `libs/core/src/lib/utils/markdown.ts:634-639` (heading → `\n# \n`), `:353-371` (list item), final
  `trim()` at `:752`; read back by `markdownToHtml` `:522` (heading needs `#\s+.+`) and `:561` (list needs
  `[-*+]\s` / `\d+\.\s`). Editor: `rich-text-editor.directive.ts:422` (`syncFromDom`), `:1207-1215`
  (`applyHistoryEntry` re-renders from the stored value).
- Problem: probe results - `<h1><br></h1>` → `"#"` → `<p>#</p>`; `<ul><li><br></li></ul>` → `"-"` →
  `<p>-</p>`; `<ol><li><br></li></ol>` → `"1."` → `<p>1.</p>`; `<p>x</p><h2><br></h2>` → `"x\n\n##"` →
  `<p>x</p><p>##</p>`. (A trailing empty item after other items drops out cleanly; only a lone empty block
  breaks.) Repros in the editor:
  1. Empty editor, type `# ` (autoformat → empty H1, history entry `"#"`), type `Title`, press Ctrl+Z: the
     editor shows a paragraph reading `#` instead of an empty heading; typing again gives `\#Title`.
  2. Type `Intro`, Enter, click the bullet-list button, save: the stored value is `"Intro\n\n-"`; the viewer,
     a reload, a multi-language switch away and back, or any undo step shows a literal `-` line.
  3. Empty editor, click H1: value `"#"` - `hasValue`, a `required` validator and the multi-language
     `isFilled` / `requiredLanguages` all count the field as filled although it holds no text.
- Fix: in `htmlToMarkdown`, drop a heading whose trimmed content is empty and a list item whose content and
  nested list are empty (or emit nothing for a list that ends up with no items); the empty block is caret
  scaffolding, not content. Spec in `markdown.spec.ts` for the four inputs above, plus an editor spec:
  type `# `, type `a`, undo → `editable.querySelector('h1')` is not null and the value is `''`.
- Breaking: no. Decision: no.

## HR-02 Pasting `text-align: -webkit-center` (any non-word value) shows the paragraph's raw HTML as text

Status: fixed

- Where: `libs/core/src/lib/utils/markdown.ts:600-616` (aligned-block extraction matches any
  `style="…text-align`), `:91-95` (`alignOf` only accepts `[a-z]+`), `:89` (`alignClass(null)` → `''`);
  `markdownToHtml` `:512-519` only rebuilds the block when `alignOf` returns a value. Editor:
  `rich-text-editor.directive.ts:702-720` (`pasteHtml`).
- Problem: Chrome serializes `<center>` content and many copied web pages with `text-align: -webkit-center`
  (`-webkit-left`, `-internal-center`, `-webkit-match-parent` too). Probe:
  `<p style="text-align: -webkit-center;">Hi <b>bold</b> <a href="https://x.dev">l</a></p>` →
  markdown `<p>Hi <b>bold</b> <a href="https://x.dev">l</a></p>` (raw HTML, no class) → `markdownToHtml`
  escapes it into `<p>&lt;p&gt;Hi &lt;b&gt;bold…</p>`. The pasted paragraph shows its own tags as text, and
  the value keeps them (`\<p>Hi <b>bold</b> \<a …>` after the next edit).
- Fix: in the aligned-block replace, compute `alignOf(attrs)` first and leave the element to the normal block
  passes when it is not one of the supported values; map `-webkit-`/`-internal-` prefixed values to their
  base (`-webkit-center` → `center`). Spec next to `rich-text-editor.directive.spec.ts:351` ("keeps the
  alignment of pasted inline styles…") with `-webkit-center` and an unknown value.
- Breaking: no. Decision: no.

## HR-03 Pasted `text-align: left/start/inherit` is stored as raw HTML, with or without the alignment tool

Status: fixed (user decision: left/start/inherit dropped; all pasted alignment dropped without the align tool)

- Where: same path as HR-02 (`markdown.ts:600-616`, `:89-95`); `rich-text-editor.directive.ts:695-729`
  never checks whether `provideRichTextEditorAlignmentTool()` is present; the tool only knows
  `left/center/right/justify` and never writes a class for `left`
  (`tools/rich-text-editor-align-tool.component.ts:19`, `:99`).
- Problem: probes - `<p style="text-align: left;">…</p>` → `<p class="et-rte-align-left">…</p>`;
  `text-align: start` → `et-rte-align-start`; `inherit` → `et-rte-align-inherit`;
  `<h2 style="text-align: justify">` → raw `<h2 class=…>`. Text copied from web pages and Word documents
  routinely carries `text-align: left`/`start`/`justify` on every paragraph, so a paste turns a plain
  document into a value made of raw-HTML blocks: inner Markdown is no longer produced for those blocks, a
  consumer that renders the Markdown elsewhere (mail, backend) gets HTML, and an editor that does not offer
  the alignment tool gives the user no way to remove it. The `left` / `start` / `inherit` blocks are states
  the tool itself never produces.
- Fix: keep alignment only for `center` / `right` / `justify` (plus `end` if wanted), drop `left`, `start`
  and anything else; decide whether pasted alignment survives when the alignment tool is not provided
  (recommendation: drop it - add a `pasteAlignment` switch on the dom feature the align tool installs).
- Breaking: no. Decision: yes (keep pasted alignment without the tool or not).

## HR-04 IME / composition input: pending marks and autoformat never apply; Enter during composition is hijacked

Status: fixed (isComposing guards, composition commits once at compositionend with pending marks and autoformat; insertFromComposition handled like insertText)

- Where: `rich-text-editor.directive.ts:1001-1010` (`interceptBeforeInput` only handles `insertText`),
  `:823-914` (`interceptKeydown` has no `event.isComposing` guard), `:805` (`input` → `syncFromDom` on every
  composition step); `headless/rich-text-editor-triggers.directive.ts:228-252` (`interceptPopupKeys` has no
  `isComposing` guard, although `syncDetection` at `:200` pauses during composition). Compare
  `tools/rich-text-editor-table.util.ts:211`, which does check `isComposing`.
- Problem:
  1. Collapsed caret, click Bold, type `東京` with a Japanese/Chinese IME: the text arrives as
     `insertCompositionText` (Chrome) / `insertFromComposition` (Safari), never `insertText`, so
     `consumePendingInsert` never runs - the text is plain, the toolbar keeps showing Bold active (the
     selectionchange refresh re-reflects `pendingMarks`), and the next Latin keystroke is the one that turns
     bold. Android Chrome with Gboard sends ordinary word typing as composition too, so the same happens there
     for every user.
  2. Safari reports the IME commit keystroke as `key: 'Enter', isComposing: true`. With the trigger popup
     open (`@` typed, then the IME used for the query), that Enter runs `selectActive()` and inserts a chip
     from the stale pre-composition result list; in an empty list item or at a heading edge it runs
     `handleEnter()` and rewrites the DOM in the middle of the composition.
  3. Each composition step commits to history (`syncFromDom` → `history.commit`); candidate selection takes
     longer than the 500 ms burst window, so undo walks back through intermediate romaji/pinyin states.
- Fix: in `interceptKeydown` and `interceptPopupKeys`, return early when `event.isComposing` (or
  `keyCode === 229`). In `interceptBeforeInput`, treat `insertFromComposition` / the composition end like
  `insertText` for pending marks (simplest: on `compositionend`, if `pendingMarks` is set, wrap the just
  committed text range in those marks and `syncFromDom({ boundary: true })`). Skip `history.commit` while
  composing and commit once on `compositionend`. Specs: dispatch `compositionstart`, a keydown with
  `isComposing: true`, `compositionend` against the directive and the triggers directive.
- Breaking: no. Decision: no.

## HR-05 A programmatic value write keeps pending marks and stale toolbar state

Status: fixed

- Where: `rich-text-editor.directive.ts:361-367` (render effect), `:459-463` (`renderExternalValue`),
  `:1217-1232` (`writeValueToDom`). Compare `applyHistoryEntry` `:1207-1215`, which calls
  `clearPendingMarks()` and `refreshActiveMarks()`.
- Problem: caret in an empty paragraph, click Bold (sets `pendingMarks`), then the app writes the value
  (`form().reset()`, a "load template" button, the multi-language component's language switch through
  `renderExternalValue`). The document is replaced but `pendingMarks` survives, so the first character typed
  into the new document is bold, and `boldActive` / `headingLevel` / `unorderedListActive` keep describing
  the old document until the next `selectionchange`. The caret is also not kept: `root.innerHTML = …` while
  focused leaves the selection collapsed at `(root, 0)`, outside any block, where the next toolbar command
  inserts at root level.
- Fix: in `renderExternalValue`, call `clearPendingMarks()` and `refreshActiveMarks()` after a successful
  write; when the editable holds focus, read `readSelectionOffsets()` before the write and
  `restoreSelectionOffsets()` after it (clamped), or place the caret at the end. Spec: toggle bold
  collapsed, set `value` from outside, type `x` → value `x`, not `**x**`.
- Breaking: no. Decision: no.

## HR-06 `requiredLanguages` throws on a `null` record, which the editor itself accepts

Status: fixed

- Where: `multi-language-rich-text-editor/multi-language-rich-text-editor-validators.ts:37-38`
  (`value()[code]`); the directive reads `this.value() ?? {}`
  (`headless/multi-language-rich-text-editor.directive.ts:38`).
- Problem: a form model loaded from an API with `translations: null` renders fine (the directive falls back
  to `{}`), but `requiredLanguages(s.translations, { codes: ['en'] })` throws
  `TypeError: Cannot read properties of null (reading 'en')` on the first validation.
- Fix: `const record = value() ?? {};` and read `record[code]`. Spec in
  `multi-language-rich-text-editor.component.spec.ts` with a `null` record.
- Breaking: no. Decision: no.
