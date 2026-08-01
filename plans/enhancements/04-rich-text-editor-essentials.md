# 04 - Rich text editor essentials

Four gaps, one of which is a data-integrity problem. Phased: history first.

## Phase 1 - undo/redo history (data-loss risk)

There is no history management at all
(`forms/rich-text-editor/headless/rich-text-editor.directive.ts` - no
Ctrl+Z/Y handling, no toolbar undo/redo, no stack). The editor relies on
native contenteditable undo, which is known to desync when the framework
rewrites DOM - and this editor does exactly that: pasted HTML is normalized
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
  instance already owns its state - verify nothing shared leaks across).

## Phase 2 - blockquote + fenced code block tools

Cheap: both are plain GFM syntax the value language already round-trips.

- `blockquote` tool: toggle `>` prefix on the selected block(s); nesting via
  repeated application, Tab/Shift+Tab consistent with list-nesting behavior.
- `codeBlock` tool: fenced ``` block; inside it, autoformat and triggers must
  be suppressed (verify the autoformat pipeline respects an "inert" block -
  see memory note about autoformat/token conflicts) and Enter inserts plain
  newlines; Escape or typing after the closing fence exits.
- Add both to the `tools` union + default toolbar ordering + icons.

## Phase 3 - image embedding

Images are currently actively stripped (paste normalization uses an inert
DOMParser; no image tool exists - `tools/` has only align + table).

- `image` tool with an **upload-handler API**, not built-in transport: the
  consumer supplies `(file: File) => <query/promise resolving to URL>` -
  compose with the existing dropzone upload primitives where possible
  (`dropzone/headless/dropzone-upload.ts`) rather than reinventing progress/
  retry. While uploading, insert a placeholder node; on success swap to the
  final URL; on failure remove + notify.
- Value representation: GFM image syntax `![alt](url)`; alt text editable via
  a small popover (reuse the link-editor pattern -
  `rich-text-editor-link-editor.component.*`).
- Accept paste/drop of image files when (and only when) a handler is
  configured; otherwise keep stripping.
- No resize/crop in scope; block-level images only (no inline float layout).

## Not in scope

Text color/highlight (no Markdown syntax; deliberate), word/char count
(covered conceptually by `05-form-field-character-counter.md` if ever needed),
horizontal-rule tool exists already (`divider` in the tool union).

## Found while implementing (2026-07-30, phase 3 - images)

**The value layer was already there.** `@ethlete/core`'s markdown pipeline round-trips
`![alt](url)` ↔ `<img src alt>`, and paste normalization never stripped an image that came in _by
URL_ - the plan's premise ("images are actively stripped") only held for image **files**. So phase 3
is the tool, the upload and the popover, not a serialization change.

**What was genuinely broken is the file paths.** Pasting or dropping an image file fell through to
the browser, which embeds it as a `blob:` URL - a URL that dies with the tab, saved into the value.
Both are now intercepted whether or not the tool is provided: uploaded when it is, refused when it
isn't. A clipboard that also carries `text/html` is left to the HTML path on purpose - Word and web
pages put both on the clipboard, and uploading the file there would drop the text.

**The placeholder had to be text-free.** The value is `htmlToMarkdown(DOM)`, so anything with text
content would show up in it (and in the undo history) while an upload is in flight. The placeholder is
therefore an empty inline `<span>` whose spinner, percentage and failed state are all CSS on its
attributes - `stripTags` leaves nothing behind. It is inserted inline (a block wrapper would serialize
as an empty paragraph) and swapped for a root-level `<p><img></p>` on success, which is the shape
`markdownToHtml` produces, so a re-render keeps what was inserted.

**Upload transport reuses the dropzone.** `upload` takes either a plain
`(file) => Promise|Observable<string>` or a `createDropzoneUpload` config; the config route hands over
the dropzone's per-file query handle, which is where progress (and the legacy-v2 flavor) comes from
for free. A `data:` URL is not a usable result - core's `isSafeUrl` refuses those for `<img src>`, so
they would vanish on the next re-render. Documented, and the story serves a real asset instead.

**Tool definitions gained `paste`/`drop`/`click`**, alongside the existing `keydown`: content hooks
that run for every provided tool, toolbar or not. The alt popover is reached by clicking the image -
that needs no reactive "image at caret" state, which a toolbar `isActive` would have (it is called
during change detection, and reading the DOM there is neither pure nor reactive). The button falls
back to opening the popover when the caret already sits on an image.

**The button is a control component** purely so `IMAGE_ICON` is registered by the tool rather than by
every editor - an opt-in tool cannot add to the editor component's own `provideIcons`.

**An image has to be an atom, which needed a fourth hook.** Verified on a phone: with an editable
`<p><img></p>`, the caret lands _beside_ the image, reading as a line of text the image happens to sit
in - and typing there breaks out of the block. So an image block gets `contenteditable="false"`, and
because a value re-render (undo, an external write) produces plain `markdownToHtml` output again, tool
definitions gained a `normalize(root)` hook that the editor runs after every render and every sync.
It must be value-neutral, which both of its jobs are: `htmlToMarkdown` drops the attribute, and the
empty trailing paragraph it keeps after a trailing image serializes to nothing. The caret now also
moves below the placeholder when the **upload starts**, not when it lands.

**The placeholder needed an image's footprint, not a character's** - a 28px inline square read as a
glyph. It is still a text-free `<span>` (that is what keeps it out of the value), now `display: block`
with the label rendered from `attr(aria-label)`, the percentage from `attr(data-progress)`, and a
progress bar as a background layer sized by a CSS var. A real block element would serialize as a
paragraph boundary; a span cannot.

**Docked toolbar / keyboard, measured on Android Chrome** (the user asked whether plain
`position: fixed; bottom: 0` would do): with Chrome's default `interactive-widget=resizes-visual` the
layout viewport stays at full height - `innerHeight 628` while only `272` is visible - so a fixed bar
sits **356px behind the keyboard**. With `interactive-widget=resizes-content` in the page's viewport
meta, `innerHeight` becomes the visible height and `bottom: 0` lands exactly on the keyboard with no
JS. So the measurement stays (for iOS, for apps that have not opted in, and for embedded frames), the
meta is documented as the app-level recommendation, and the playground deliberately does **not** set it
so mobile verification keeps exercising the harder default. Two real gaps found: the position could go stale when the
keyboard changed height without a viewport event (the docked bar now re-measures on a slow timer while
it is up), and - the user's own reproduction - **while a tab belongs to a Chrome tab group**, Chrome
reports a visible viewport one tab-group-strip shorter than it is, so the bar lands exactly that
strip's height too high; outside a group the placement is exact. Nothing in the page can tell the two
apart (the strip is already out of `innerHeight`, and the keyboard overlap is then subtracted a second
time), so the _placement_ cannot be corrected - but the damage can be, and that is what shipped: the
docked bar now clears the keyboard with `padding-block-end`, its box reaching the bottom of the layout
viewport, so an over-reported keyboard is absorbed by the bar's own background instead of opening a gap
with page content in it. Everything below the tools is behind the keyboard or behind browser chrome, so
it is unreachable either way. Not reproducible on the emulator: its Chrome build offers no way to create
a tab group over adb, so the fix was verified by driving the inset variable directly (0 / 200 / 320px:
the box bottom stays at the viewport bottom, the tools clear by exactly inset + padding).

**The exact answer, when a page opts in, is the VirtualKeyboard API** (user's suggestion): the padding
is `max(measured inset, env(keyboard-inset-height, 0px))`, which needs no feature detection - a page
that set `navigator.virtualKeyboard.overlaysContent = true` no longer has its viewport resized, so the
measurement is 0 there and the env var carries it; everywhere else the env var falls back to 0. The
library cannot opt in on the app's behalf: `overlaysContent` also turns off the browser's own
scroll-focused-field-into-view, which is the app's layout to own. Verified in Chromium that the API is
present, that the opt-in sticks and that the declaration stays valid with the env var at 0 (a non-zero
`keyboard-inset-height` needs a real keyboard on an opted-in page - untested).

## Found while implementing (2026-07-30, phases 1 & 2)

**Undo granularity is a value-level diff, not a keystroke counter.** The history commits at
`syncFromDom`, the one point every edit funnels through, and coalesces by comparing the previous
value with the new one: a commit whose inserted chunk crosses whitespace starts a new entry, every
other non-programmatic commit extends the current one. Time alone (the planned ~500 ms) is not enough

- a trailing space is trimmed out of the Markdown value, so the space keystroke commits _nothing_ and
  the whitespace only shows up in the diff of the _next_ character. Undo therefore lands exactly on
  word boundaries; the first attempt (closing the burst _after_ the whitespace commit) landed one
  character past them.

**Selection has to be stored as text offsets.** Undo re-renders the editable from the value, so a
saved `Range` points at detached nodes. `Range.toString().length` from the root to the caret is the
cheapest reliable metric, and a text-node walk restores it (`rich-text-editor-dom-history.ts`).

**External writes reset the stack, which is what makes the multi-language wrapper correct.** That
wrapper is _one_ editor whose `value` swaps per language - verified in Storybook that undo after a
language switch cannot pull the previous language's text into the current one.

**Blockquote nesting needed `@ethlete/core` first.** `markdownToHtml`/`htmlToMarkdown` flattened
`>>` (one non-greedy regex can't match balanced nesting), so both directions now scan by depth,
mirroring the existing list helpers.

**Quote depth applies to the whole quote, not to one line.** A quote's lines are `<br>`-separated
inside one `<blockquote>` - the shape `markdownToHtml` produces, and the shape a re-render must
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

**Also shipped (user request, not in the plan):** pasted text that spells a token out - `#First
name`, the trigger char plus an item's label or id - is recognized and inserted as a chip, for HTML
and plain-text clipboards alike (`parsePastedTokens` on `etRichTextEditorTriggers` opts out). It fell
out of the paste pipeline the same phase touched. A trigger with a static `items` list also no longer
needs `resolveItem` just to render chip labels.

## Verification & shipping

Stories per phase (undo across paste+autoformat is the critical story -
scripted via verify-in-storybook: type, paste HTML, autoformat, undo ×N, redo
×N, assert value). Update `apps/docs/components/rich-text-editor.md` (tools
table, history section, upload-handler API). i18n: new tool aria-labels go
through the RTE labels token from `03-i18n-consolidation.md` if it has landed,
else follow the existing pattern and note the migration. Changeset:
`@ethlete/components` (minor).
