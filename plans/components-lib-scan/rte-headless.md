# Rich text editor headless scan - open findings

Scan of `libs/components/src/lib/forms/rich-text-editor/headless/` from 2026-09-28. 2 High, 11 Medium, 11 Low, 2 Spec. Verification: 13 of 13 High/Medium confirmed, 0 re-rated, 0 refuted. Skipped: the spec files (read only to judge coverage), and `markdownToHtml`/`htmlToMarkdown`/`isSafeLinkUrl` in `libs/core` (out of scope, but read far enough to confirm that the pasted and typed link hrefs pass `isSafeLinkUrl` on both sides of the pipeline). Paths are relative to `forms/rich-text-editor/`.

## Inline marks and links

- Low: `insertInlineText` via `splitInlineAncestorsAtCaret` walks past an `<a>` to a mark outside it and splits the link into two anchors (`headless/internals/rich-text-editor-dom-inline-marks.ts:386-399`). A pending bold inside `**[link](x)**` serializes as two adjacent links. Stop the walk at `a`. S

## Paste and HTML parsing

- Low: `serializeCleanHtml` rewrites only bare `<div>` openers but every `</div>` closer, so a `<div class="…">` leaves an opener without its match (`headless/rich-text-editor.directive.ts:827-828`). Re-tag `div` elements on the clone in the DOM instead of a string replace. S

## Token triggers

- Low: `listenersAttached` stops the listeners from attaching again, so after `attachEditable` receives a new element the triggers keep their listeners on the old root (`headless/rich-text-editor-triggers.directive.ts:139-146`). Use `effect` + `onCleanup` like the floating toolbar does. S
- Low: `aria-activedescendant` points at `…-option-0` while the popup shows loading, "No results" or an error, where that option does not exist (`headless/rich-text-editor-triggers.directive.ts:156-170`). Set it only when items exist. S

## Selection and history

- Low: `restoreSelection` adds `lastRange` back without the `el.contains(…)` check that `ensureCaret` does (`headless/internals/rich-text-editor-dom-core.ts:72-82`). After an external value write, `innerHTML` replaced the nodes, so a toolbar command from an unfocused editor restores a detached range and silently does nothing. Fall back to `ensureCaret()` when the range is stale. S
- Low: ordered-list autoformat drops the typed start number: `3. ` gives a list that starts at 1 (`headless/internals/rich-text-editor-dom-autoformat.ts:53`). Set `start` on the `<ol>`, if the Markdown pass keeps it. S

## Cleanup

- Low: the no-break-space explanation appears at four call sites (`headless/rich-text-editor.directive.ts:767-768`, `headless/rich-text-editor-triggers.directive.ts:321-323`, `headless/internals/rich-text-editor-dom-core.ts:161-163`, `headless/internals/rich-text-editor-dom-inline-marks.ts:429-430`). Keep it once on `collapseAfterInline` and delete the others. S
- Low: comments outside the AGENTS.md allowlist: JSDoc on private state (`headless/rich-text-editor-triggers.directive.ts:102`, `headless/rich-text-editor-link-editor.directive.ts:34-35`), config rationale (`headless/rich-text-editor-link-editor.directive.ts:104-105,117-118,122-124`, `headless/rich-text-editor-floating-toolbar.directive.ts:98`). S
- Low: `isPromiseLike` is duplicated (`headless/internals/rich-text-editor-token.ts:85`, `headless/internals/rich-text-editor-trigger-source.ts:23`). S
- Low: unused exported types `RichTextEditorDomHistory`, `RichTextEditorDomKeymap`, `RichTextEditorDomInlineMarks`, `RichTextEditorDomPaste`, `RichTextEditorHistory` (`dom-history.ts:68`, `dom-keymap.ts:159`, `dom-inline-marks.ts:451`, `dom-paste.ts:71`, `history.ts:124` under `headless/internals/`); `tokenMarkdown`, `buildChipHtml`, `TOKEN_PREFIX_CLASS` and `filterStaticItems` are exported but used only in their own file. S
- Low: `refreshActiveMarks` sets the five inline flags by hand, which duplicates `reflectMarks` (`headless/rich-text-editor.directive.ts:415-419`). S

## Spec gaps

- Spec: no spec for `indentListItem`. S
- Spec: no spec for the `trackTriggerItems` stale-result drop. S
