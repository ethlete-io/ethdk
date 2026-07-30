# 04 — Rich text editor essentials

Four gaps, one of which is a data-integrity problem. Phased: history first.

## Phase 1 — undo/redo history (data-loss risk)

There is no history management at all
(`forms/rich-text-editor/headless/rich-text-editor.directive.ts` — no
Ctrl+Z/Y handling, no toolbar undo/redo, no stack). The editor relies on
native contenteditable undo, which is known to desync when the framework
rewrites DOM — and this editor does exactly that: pasted HTML is normalized
through the Markdown pipeline, autoformat rewrites text into structure. After
such a rewrite, native undo can restore a DOM state the editor's model never
had, or do nothing.

Design:

- Explicit history stack on the headless directive: snapshots of the editor's
  canonical value (the Markdown-ish model, not raw DOM) + selection.
- Coalesce plain typing into one entry per burst (time gap ~500 ms or on
  word-boundary); **hard boundary** (own entry) around every programmatic
  rewrite: paste normalization, autoformat application, tool execution
  (table/align/link/heading/list), trigger/token insertion.
- Intercept `Ctrl/Cmd+Z`, `Ctrl+Y`/`Cmd+Shift+Z` and `beforeinput` with
  `inputType: 'historyUndo'/'historyRedo'` (covers native menu/gesture undo);
  `preventDefault()` and apply from our stack so the native stack never
  diverges visibly.
- Restore = set value + restore selection; must not scroll-jump.
- Cap the stack (e.g. 100 entries); expose `canUndo`/`canRedo` signals for
  toolbar buttons; add `undo`/`redo` to the tool token union so the default
  toolbar can include them.
- Multi-language wrapper: history is per-language-instance (each editor
  instance already owns its state — verify nothing shared leaks across).

## Phase 2 — blockquote + fenced code block tools

Cheap: both are plain GFM syntax the value language already round-trips.

- `blockquote` tool: toggle `>` prefix on the selected block(s); nesting via
  repeated application, Tab/Shift+Tab consistent with list-nesting behavior.
- `codeBlock` tool: fenced ``` block; inside it, autoformat and triggers must
  be suppressed (verify the autoformat pipeline respects an "inert" block —
  see memory note about autoformat/token conflicts) and Enter inserts plain
  newlines; Escape or typing after the closing fence exits.
- Add both to the `tools` union + default toolbar ordering + icons.

## Phase 3 — image embedding

Images are currently actively stripped (paste normalization uses an inert
DOMParser; no image tool exists — `tools/` has only align + table).

- `image` tool with an **upload-handler API**, not built-in transport: the
  consumer supplies `(file: File) => <query/promise resolving to URL>` —
  compose with the existing dropzone upload primitives where possible
  (`dropzone/headless/dropzone-upload.ts`) rather than reinventing progress/
  retry. While uploading, insert a placeholder node; on success swap to the
  final URL; on failure remove + notify.
- Value representation: GFM image syntax `![alt](url)`; alt text editable via
  a small popover (reuse the link-editor pattern —
  `rich-text-editor-link-editor.component.*`).
- Accept paste/drop of image files when (and only when) a handler is
  configured; otherwise keep stripping.
- No resize/crop in scope; block-level images only (no inline float layout).

## Not in scope

Text color/highlight (no Markdown syntax; deliberate), word/char count
(covered conceptually by `05-form-field-character-counter.md` if ever needed),
horizontal-rule tool exists already (`divider` in the tool union).

## Found while implementing (2026-07-30, phases 1 & 2)

**Undo granularity is a value-level diff, not a keystroke counter.** The history commits at
`syncFromDom`, the one point every edit funnels through, and coalesces by comparing the previous
value with the new one: a commit whose inserted chunk crosses whitespace starts a new entry, every
other non-programmatic commit extends the current one. Time alone (the planned ~500 ms) is not enough
— a trailing space is trimmed out of the Markdown value, so the space keystroke commits _nothing_ and
the whitespace only shows up in the diff of the _next_ character. Undo therefore lands exactly on
word boundaries; the first attempt (closing the burst _after_ the whitespace commit) landed one
character past them.

**Selection has to be stored as text offsets.** Undo re-renders the editable from the value, so a
saved `Range` points at detached nodes. `Range.toString().length` from the root to the caret is the
cheapest reliable metric, and a text-node walk restores it (`rich-text-editor-dom-history.ts`).

**External writes reset the stack, which is what makes the multi-language wrapper correct.** That
wrapper is _one_ editor whose `value` swaps per language — verified in Storybook that undo after a
language switch cannot pull the previous language's text into the current one.

**Blockquote nesting needed `@ethlete/core` first.** `markdownToHtml`/`htmlToMarkdown` flattened
`>>` (one non-greedy regex can't match balanced nesting), so both directions now scan by depth,
mirroring the existing list helpers.

**Quote depth applies to the whole quote, not to one line.** A quote's lines are `<br>`-separated
inside one `<blockquote>` — the shape `markdownToHtml` produces, and the shape a re-render must
therefore keep. Per-line nesting would need per-line elements, which the value can't express. So
Tab/Shift+Tab move the quote, not the line: a documented deviation from "consistent with
list-nesting behavior".

**Enter inside a quote had to be taken over.** Chrome splits the `<blockquote>` in two, which
serializes as two quotes; the editor inserts a line break inside the one quote instead (plus the
trailing `<br>` that gives the new empty line a line box, and empty text nodes `Range.insertNode`
leaves behind have to be skipped when cleaning that up).

**Select-all + delete inside a block leaves its wrapper behind.** Chrome keeps `<pre>` (minus its
`<code>`) and an empty `<blockquote>`, and the caret then goes on typing literal code with every tool
disabled and no way out. Both are repaired on the native input path only, keyed on a shape the editor
itself never produces (a `<pre>` without `<code>`, a childless quote). Only Storybook found this.

**Also shipped (user request, not in the plan):** pasted text that spells a token out — `#First
name`, the trigger char plus an item's label or id — is recognized and inserted as a chip, for HTML
and plain-text clipboards alike (`parsePastedTokens` on `etRichTextEditorTriggers` opts out). It fell
out of the paste pipeline the same phase touched. A trigger with a static `items` list also no longer
needs `resolveItem` just to render chip labels.

## Verification & shipping

Stories per phase (undo across paste+autoformat is the critical story —
scripted via verify-in-storybook: type, paste HTML, autoformat, undo ×N, redo
×N, assert value). Update `apps/docs/components/rich-text-editor.md` (tools
table, history section, upload-handler API). i18n: new tool aria-labels go
through the RTE labels token from `03-i18n-consolidation.md` if it has landed,
else follow the existing pattern and note the migration. Changeset:
`@ethlete/components` (minor).
