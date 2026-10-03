# rte — DX scan 2026-10-02

Scope: `libs/components/src/lib/forms/rich-text-editor`, `libs/components/src/lib/forms/multi-language-rich-text-editor`,
`apps/docs/components/rich-text-editor.md`, their stories.

| ID     | Sev    | Kind     | Decision | Title                                                                                                  |
| ------ | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| RTE-01 | High   | bug      | no       | Multi-language editor never forwards `touched` - submit/reset don't show or clear errors (fixed)       |
| RTE-02 | High   | dx       | yes      | Image tool config is static: `upload` / `onFailure` cannot reach a service (fixed)                     |
| RTE-03 | Medium | bug      | no       | Multi-language editor ignores `provideRichTextEditorTools()` (fixed)                                   |
| RTE-04 | Medium | bug      | no       | Undo after a language switch can write another language's text into the active one (fixed)             |
| RTE-05 | Medium | dx       | yes      | Multi-language editor cannot use triggers, the token palette or `insertToken`                          |
| RTE-06 | Medium | dx       | yes      | Headless `[etRichTextEditor]` gets no paste/drop/undo/autoformat/tool-hook handling                    |
| RTE-07 | Medium | bug      | no       | Trigger popup puts `aria-expanded` on a `role="textbox"` and leaves `aria-controls` behind             |
| RTE-08 | Medium | dx       | no       | Custom tools: no `provide…Tool` helper; a non-`multi` provider crashes with "not iterable" (fixed)     |
| RTE-09 | Medium | dx       | no       | Trigger config is validated late (`type`) or never (`char`) (fixed)                                    |
| RTE-10 | Medium | dx       | no       | Misconfigured tools fail silently - no dev warning for unprovided tokens or a lone link editor (fixed) |
| RTE-11 | Medium | dx       | no       | ET2600 / ET2601 (multi-language) are missing from the error-code docs (fixed)                          |
| RTE-12 | Medium | test-gap | no       | No spec for multi-language form integration, the floating toolbar or the token palette (fixed)         |
| RTE-13 | Low    | dx       | no       | `requiredLanguages`: codes are read once, message is hard-coded English (fixed)                        |
| RTE-14 | Low    | dx       | no       | Internals leak through the public entry point (fixed)                                                  |
| RTE-15 | Low    | dx       | no       | `toggleHeading(level: number)` accepts levels that produce `<h0>` / `<h7>` (fixed)                     |
| RTE-16 | Low    | dx       | no       | Language tool on a bare editor renders a dead, disabled switcher; JSDoc says it is supported (fixed)   |

## RTE-01 Multi-language editor never forwards `touched` - submit/reset don't show or clear errors

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor.component.html:2-18`,
  `libs/components/src/lib/forms/form-field/headless/form-field.directive.ts:115-125`
- Problem: the template binds `(touchedChange)="dir.touched.set($event)"` but never `[touched]="dir.touched()"`. The
  form field registers the **inner** `RichTextEditorDirective` (it is the one that injects `FORM_FIELD_TOKEN`), so
  `shouldDisplayError()` reads the inner editor's `touched`. Signal forms writes `touched` only to the outer
  directive. Result with `requiredLanguages(s.translations, { codes: ['en'] })`: `submit(form)` / `markAsTouched()`
  sets the outer `touched` to `true`, but no error, no `aria-invalid`, no red border shows until the user focuses and
  blurs the editor. The other direction too: `form().reset()` sets touched back to `false` outside, the inner stays
  `true`, so the error keeps showing on a reset form.
- Fix: add `[touched]="dir.touched()"` to the inner editor in the template (the inner `touched` is a `model`, so the
  existing `(touchedChange)` keeps the up direction). Add specs: submit marks touched → field shows the
  `requiredLanguages` error; reset clears it.
- Breaking: no. Decision: no.
- Status: fixed - `[touched]` bound into the inner editor; form-integrated specs (submit, reset)
- Review: ok

## RTE-02 Image tool config is static: `upload` / `onFailure` cannot reach a service

- Where: `libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-image.provider.ts:85-103`,
  `libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-image-upload.ts:71-72`, docs
  `apps/docs/components/rich-text-editor.md:332-342`, JSDoc example at `rich-text-editor-image.provider.ts:76-83`
- Problem: `provideRichTextEditorImageTool(config)` takes a plain object, evaluated where the `providers` array is
  written. The docs and the JSDoc show
  `upload: (file) => this.api.uploadImage(file)…, onFailure: … this.notifications.open(…)` inside `providers: [...]` -
  decorator metadata has no `this`, so that example cannot compile. The function `upload` is called plainly
  (`upload(file, { signal })`), not in an injection context, so `inject(HttpClient)` inside it throws NG0203. The only
  working way to reach DI is the `createDropzoneUpload` variant; `onFailure` (where an app wants its notification
  service) has no way at all. A consumer copies the documented example and loses time.
- Fix: accept `config: RichTextEditorImageToolConfig | (() => RichTextEditorImageToolConfig)` and call the factory
  inside the existing `useFactory` (which is an injection context), so
  `provideRichTextEditorImageTool(() => { const api = inject(Api); return { upload: (f) => api.upload(f), onFailure: … }; })`
  works. Rewrite the docs and JSDoc examples to that shape (or to `createDropzoneUpload` + a factory for `onFailure`).
- Breaking: no (the object form stays). Decision: yes (API shape: factory overload vs. `deps`-style).
- Status: fixed - `provideRichTextEditorImageTool(() => config)` runs the factory in the provider's injection context; docs + JSDoc use it
- Review: ok

## RTE-03 Multi-language editor ignores `provideRichTextEditorTools()`

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor.component.ts:57-61`
- Problem: `innerTools` is `[language, 'divider', ...(this.tools() ?? DEFAULT_RICH_TEXT_EDITOR_TOOLS)]` and is always
  passed as the inner editor's `[tools]`, which wins over the injected config. An app that sets
  `provideRichTextEditorTools(['bold', 'italic', 'link'])` (docs: "To set the default for many editors at once")
  gets its configured bar on every `et-rich-text-editor` but the full default bar on every multi-language editor.
- Fix: fall back to `injectRichTextEditorTools().tools` instead of `DEFAULT_RICH_TEXT_EDITOR_TOOLS`. Spec it.
- Breaking: no. Decision: no.
- Status: fixed - falls back to `provideRichTextEditorTools`; spec
- Review: ok

## RTE-04 Undo after a language switch can write another language's text into the active one

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts:316-322` and `:407-412`,
  `libs/components/src/lib/forms/multi-language-rich-text-editor/headless/multi-language-rich-text-editor.directive.ts:55`
- Problem: the history only resets when the value effect re-renders, and the effect skips a value equal to
  `lastEmittedMarkdown`. A language switch is an "outside write" only if the new language's Markdown differs from what
  the editor last emitted. Input: in `en`, type "Hello", delete it again (value `''`, history `['', …, 'Hello', '']`);
  switch to `de`, which is `''` → `activeMarkdown` stays `''`, nothing re-renders, the history is kept; press Ctrl+Z →
  "Hello" appears in `de` and is written to `value.de`. The same happens when two languages hold identical text
  (product names). The docs promise a fresh history on a language switch (`rich-text-editor.md:77-79`).
- Fix: on `activeLanguage` change, force a re-render + history reset of the inner editor (e.g. an effect in the
  multi-language component calling `editor.dir.renderExternalValue(markdown)` or a public `resetHistory()`), instead
  of relying on value inequality. Spec the two inputs above.
- Breaking: no. Decision: no.
- Status: fixed - the multi-language component re-renders and resets the inner history on every language change; specs for both inputs
- Review: ok

## RTE-05 Multi-language editor cannot use triggers, the token palette or `insertToken`

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:52,106-111`,
  `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor.component.html:2-18`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor-token-palette.component.ts:47`
- Problem: `etRichTextEditorTriggers` injects `RichTextEditorDirective` from its own element. On
  `<et-multi-language-rich-text-editor etRichTextEditorTriggers [triggers]="…">` there is none (the editor is inside the
  template), so it throws ET2504. The inner editor has no `triggers` pass-through, and the component exposes only
  `focus()` - no way to reach the inner directive for `insertToken`, or to point `et-rich-text-editor-token-palette`
  `[editor]` at it. Multi-language merge-field templates (emails, notifications in several languages) are a likely use
  case. Only display works, via `provideRichTextEditorTokenRendering`.
- Fix: add a `triggers` input (+ `parsePastedTokens`) on the multi-language component that applies
  `RichTextEditorTriggersDirective` to the inner editor (host directive on an inner wrapper, or the inner element
  carrying `etRichTextEditorTriggers`), and expose the inner `RichTextEditorDirective` (`editor` signal, or
  `insertToken`/`insertTokenItem` delegates) so the palette and app buttons work. Document both.
- Breaking: no. Decision: yes (new API).

## RTE-06 Headless `[etRichTextEditor]` gets no paste/drop/undo/autoformat/tool-hook handling

- Where: `libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.ts:171-369`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.html:51-59`, docs
  `apps/docs/components/rich-text-editor.md:663-693`
- Problem: every event the editor depends on - `keydown` (undo/redo, list Tab, code-block exits, tool `keydown`),
  `beforeinput` (formatting shortcuts, `historyUndo`, autoformat, pending marks), `paste` (HTML normalization, image
  paste, token text), `drop` (refusing `blob:` files), `click` (image popover), `focus`/`blur` (touched) - is a
  `protected` method on `RichTextEditorComponent`. The docs say a headless editor only lacks "the keyboard handling";
  in fact it also gets native undo (which the docs call unsafe a few sections earlier), unnormalized pasted markup in
  the DOM, no `provideRichTextEditorAutoformat()` effect, no table/image tool hooks, and never becomes `touched`. A
  consumer following the headless example and adding `provideRichTextEditorImageTool` gets nothing.
- Fix: move the handlers into `RichTextEditorDirective` and bind them inside `attachEditable(element)` (listeners
  owned by the directive's `DestroyRef`), so the component only renders. Then the docs headless section shrinks to
  "attach the element". Until then, at least correct the docs to list what is missing.
- Breaking: no. Decision: yes (where the event wiring lives).

## RTE-07 Trigger popup puts `aria-expanded` on a `role="textbox"` and leaves `aria-controls` behind

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:446-457`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.html:61`
- Problem: `setAriaExpanded` writes `aria-expanded` onto the editable, which is `role="textbox"`. ARIA 1.2 does not
  allow `aria-expanded` on `textbox` (axe `aria-allowed-attr`). On close it sets `aria-expanded="false"` but keeps
  `aria-controls` pointing at a listbox id that no longer exists, so every editor that opened the popup once carries
  a dangling reference. Storybook's axe run only reports, so this is not caught.
- Fix: drop `aria-expanded`; keep `aria-haspopup="listbox"` (allowed on textbox) and `aria-activedescendant`; set
  `aria-controls` only while open and remove it on close. Update `rich-text-editor-triggers.directive.spec.ts:91`.
- Breaking: no. Decision: no.
- Status: fixed in `fix(components): Drop aria-expanded from the rich text editor textbox` - `aria-haspopup="listbox"`
  set while triggers are attached, `aria-controls` only while the popup is open; spec + e2e assertions

## RTE-08 Custom tools: no `provide…Tool` helper; a non-`multi` provider crashes with "not iterable"

- Where: `libs/components/src/lib/forms/rich-text-editor/rich-text-editor-tools.ts:245`,
  `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts:143,189,302,820`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.ts:142,244`
- Problem: the docs (`rich-text-editor.md:318-324`) tell apps to register a tool "through the
  `RICH_TEXT_EDITOR_TOOL` multi-provider token" with no example. Writing
  `{ provide: RICH_TEXT_EDITOR_TOOL, useValue: myTool }` (forgetting `multi: true`) makes `inject()` return an object,
  and `for (const def of this.registeredTools ?? [])` throws `TypeError: … is not iterable` at editor construction -
  no code, no hint. There is no story with a custom tool either.
- Fix: export `provideRichTextEditorTool(def: RichTextEditorToolDefinition | (() => RichTextEditorToolDefinition))`
  that always sets `multi: true` (factory form runs in an injection context, like the image tool). Use it in the
  built-in providers, add a docs snippet and a small story (e.g. a "clear formatting" button).
- Breaking: no. Decision: no.
- Status: fixed - `provideRichTextEditorTool(def | () => def)` used by every built-in provider; a non-`multi` provider throws ET2507 in dev; docs snippet (no story added)
- Review: ok

## RTE-09 Trigger config is validated late (`type`) or never (`char`)

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:284,459-481`,
  `libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-trigger-detection.ts:40-45`
- Problem: `assertUniqueTriggers` only checks duplicates. A malformed `type` (`'Mention'`, `'merge_field'`) throws
  ET2502 only when the user picks an item (`assertValidToken` in `insertItem`), i.e. in QA, not at startup. `char` is
  never validated: detection assumes one character (`query = text.slice(charOffset + 1, …)`), so `char: '{{'` makes
  the query start with `{` and nothing matches, and `char: ''` matches at every caret position.
- Fix: in the dev-mode `assertUniqueTriggers` effect also assert `TOKEN_TYPE_RE.test(type)` (ET2502) and
  `char.length === 1` (new code, or reuse ET2500 with a clear message). Mention the one-character rule in the
  `RichTextEditorTrigger.char` JSDoc.
- Breaking: no. Decision: no.
- Status: fixed - dev effect asserts `type` (ET2502) and one-character `char` (new ET2508); specs
- Review: ok

## RTE-10 Misconfigured tools fail silently - no dev warning for unprovided tokens or a lone link editor

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts:198-213`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor-link-editor.provider.ts:16-19`
- Problem: `resolvedTools` drops every token without a definition. That is the intended default-toolbar behavior,
  but it also swallows an explicit `[tools]="['heading', 'blod', 'table']"` with no heading/table provider and a typo:
  the bar just lacks them. Since v6 made heading/quote/code/link opt-in, "my heading menu disappeared" is the likely
  upgrade symptom (the migration only scans). Likewise `provideRichTextEditorLinkEditor()` without
  `provideRichTextEditorLinkTool()` renders no link button and says nothing.
- Fix: in dev mode, warn once per editor for tokens in the **instance `tools` input or `provideRichTextEditorTools`**
  (not `DEFAULT_RICH_TEXT_EDITOR_TOOLS`) that have no definition, naming the provider for known tokens. Warn when the
  link-editor setup runs while `editorDom.links` is absent.
- Breaking: no. Decision: no.
- Status: fixed - dev warning per missing token from `tools`/`provideRichTextEditorTools` (not the default list), naming the provider; link-editor-without-link-tool warning
- Review: ok

## RTE-11 ET2600 / ET2601 (multi-language) are missing from the error-code docs

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor-errors.ts:1-5`,
  `apps/docs/components/error-codes.md:44-46`
- Problem: the range table jumps from 2500 to 2700; "no languages" (ET2600) and "duplicate code" (ET2601) are
  reported through `ErrorHandler` and the editor renders nothing, but a consumer searching the code finds no entry.
- Fix: add the 2600-2699 row and a "Multi-language rich text editor (ET26xx)" section with cause and fix for both;
  mention them in the multi-language section of `rich-text-editor.md`.
- Breaking: no. Decision: no.
- Status: fixed - 2600 range row + ET26xx section in error-codes.md; mentioned in the guide
- Review: ok

## RTE-12 No spec for multi-language form integration, the floating toolbar or the token palette

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor.component.spec.ts`,
  `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-floating-toolbar.directive.ts`,
  `libs/components/src/lib/forms/rich-text-editor/rich-text-editor-token-palette.component.ts`
- Problem: the multi-language spec drives the wrapper directly and never through `form()` + `[formField]` +
  `et-form-field`, which is how RTE-01, RTE-03 and RTE-04 slipped through. The floating toolbar and the token palette
  have no spec at all (palette: disabled items, failing source dropping only its run, `focusEditorOnInsert`).
- Fix: add a form-integrated multi-language spec (submit/reset/touched, required error, tool config, undo after
  switch); add specs for the palette and for the floating toolbar's show/hide on selection and touch suppression.
- Breaking: no. Decision: no.
- Status: fixed - form-integrated multi-language specs; palette + floating toolbar specs
- Review: fixed - the token palette now catches a source that throws synchronously (`defer`), with a spec

## RTE-13 `requiredLanguages`: codes are read once, message is hard-coded English

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor-validators.ts:27-37`,
  story `multi-language-rich-text-editor/stories/multi-language-rich-text-editor-storybook.component.ts:81`
- Problem: `codes` is a plain array captured at schema creation; the story passes `this.requiredCodes()` from a
  `computed`, which reads as reactive but is not. The default message `Missing translations: en` is English with no
  label hook, while every other editor string is in `RICH_TEXT_EDITOR_LABELS`.
- Fix: accept `codes: readonly string[] | (() => readonly string[])` and read it inside the `validate` callback; take
  the default message from a label (`languagesRequired(codes)`) or document that `message` is the localization path.
- Breaking: no. Decision: no.
- Status: fixed - `codes` accepts a function; `message` accepts a function (documented localization path); story passes a function
- Review: ok

## RTE-14 Internals leak through the public entry point

- Where: `headless/rich-text-editor-link-editor.directive.ts:27` (`setupRichTextEditorLinkEditor`, `@internal`),
  `headless/rich-text-editor-floating-toolbar.directive.ts:28` (`setupRichTextEditorFloatingToolbar`, `@internal`),
  `tools/rich-text-editor-image-upload.ts:42-64` (`startImageUpload`, `StartImageUploadOptions`,
  `RichTextEditorImageUploadRun`, no tag), `tools/rich-text-editor-*-styles.component.ts`; on the directive
  `editorDom`, `toolDefs`, `tokenCodec`, `pendingMarks` (`rich-text-editor.directive.ts:146,182,219,271`) and the
  writable state signals `boldActive` … `inTableCell` (`:235-251`)
- Problem: all of it is `export *`-ed from `@ethlete/components` and shows up in autocomplete; the state signals are
  writable, so `editor.boldActive.set(true)` compiles and desyncs the toolbar. Meanwhile the one type a consumer
  needs to supply a custom codec (`RichTextEditorTokenCodec`, docs `rich-text-editor.md:536-539`) is **not** exported.
- Fix: stop exporting the setup functions and upload internals from the barrels (import them by path inside the lib);
  expose the state signals as `.asReadonly()`; export `RichTextEditorTokenCodec`.
- Breaking: yes (removed exports). Decision: no.
- Status: fixed - setup functions, upload internals and styles components dropped from the barrels; state signals `.asReadonly()`; `RichTextEditorTokenCodec`/`RichTextEditorTokenChip` exported; no ea-frontend hits
- Review: ok - changesets cut to the 40-word rule

## RTE-15 `toggleHeading(level: number)` accepts levels that produce `<h0>` / `<h7>`

- Where: `libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts:543-567`
- Problem: `toggleHeading(7)` casts to `` `h${level}` as HeadingTag `` and creates an unknown `<h7>` element;
  `setHeading(0)` likewise. The heading menu offers 1-3 and `HeadingTag` is `h1`-`h6`.
- Fix: type `level` as `1 | 2 | 3 | 4 | 5 | 6` (`setHeading`: `… | null`).
- Breaking: yes (type narrowing). Decision: no.
- Status: fixed - `RichTextEditorHeadingLevel` (1-6) on `toggleHeading`/`setHeading`/`headingLevel`; no ea-frontend hits
- Review: ok

## RTE-16 Language tool on a bare editor renders a dead, disabled switcher; JSDoc says it is supported

- Where: `libs/components/src/lib/forms/multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language.provider.ts:13-18`,
  `tools/multi-language-rich-text-editor-language-tool.component.ts:18,28-30,42-44`
- Problem: the JSDoc says `provideRichTextEditorLanguageTool` is "exported for advanced setups that compose the
  switcher into a bare `<et-rich-text-editor>`". Without an ancestor `[etMultiLanguageRichTextEditor]` the tool's
  `wrapper` is `null`, `languages()` is `[]` and the button is permanently disabled, with no warning. The headless
  `[etMultiLanguageRichTextEditor]` composition it implies is documented nowhere.
- Fix: dev-mode error when the tool renders without the wrapper, and either document the headless composition or
  drop the "advanced setups" sentence and the export.
- Breaking: no. Decision: no.
- Status: fixed - dev ET2602 when the language tool renders without the wrapper; "advanced setups" JSDoc sentence dropped (export kept)
- Review: ok
