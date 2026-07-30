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

## Verification & shipping

Stories per phase (undo across paste+autoformat is the critical story —
scripted via verify-in-storybook: type, paste HTML, autoformat, undo ×N, redo
×N, assert value). Update `apps/docs/components/rich-text-editor.md` (tools
table, history section, upload-handler API). i18n: new tool aria-labels go
through the RTE labels token from `03-i18n-consolidation.md` if it has landed,
else follow the existing pattern and note the migration. Changeset:
`@ethlete/components` (minor).
