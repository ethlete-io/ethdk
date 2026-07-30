# Rich text editor

`et-rich-text-editor` is a Markdown-valued editor built on `contenteditable` (no ProseMirror dependency): the `value` model is **Markdown**, converted to/from HTML internally. It ships a static toolbar (undo/redo, block-style menu, bold, italic, underline, strikethrough, inline code, lists, links) plus a floating toolbar over the active selection, and uses the same field shell as the other [form controls](/components/forms). On touch devices, while editing, the toolbar automatically docks above the on-screen keyboard (the top is left to the platform's selection menu), so formatting stays reachable — tracking the keyboard through scrolling and same-origin iframe embeddings. The editable's font size is floored at 16px there, so iOS Safari doesn't zoom the page on focus.

## Importing

| Array                                     | Contains                             |
| ----------------------------------------- | ------------------------------------ |
| `RICH_TEXT_EDITOR_IMPORTS`                | `et-rich-text-editor`                |
| `MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS` | `et-multi-language-rich-text-editor` |

Spread the editor's imports alongside `FORM_FIELD_IMPORTS` (from the [forms guide](/components/forms)) so the label/hint chrome comes along:

```ts
import { FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS } from '@ethlete/components';
```

```html
<et-form-field>
  <et-label>Match report</et-label>
  <et-rich-text-editor [formField]="demoForm.report" placeholder="Write something…" />
</et-form-field>
```

<StoryEmbed id="components-forms-rich-text-editor--default" height="420px" />

The editable region is a `role="textbox" aria-multiline="true"` with full invalid/described-by wiring. In a list, **Tab** / **Shift+Tab** nest and un-nest the current item (marker style cycles by depth), and **Enter** / **Backspace** on an empty item step out one level at a time. **Enter** at the start or end of a heading begins a plain paragraph instead of continuing the heading (mid-heading it splits, as everywhere else); **Shift+Enter** is always a soft line break.

Pasted HTML is normalized into the editor's own schema before it is inserted: the clipboard markup is reduced through the Markdown pipeline, so foreign tags, inline styles, classes and scripts never enter the editor — only formatting the editor itself can produce survives (token chips copied from an editor keep their identity). Plain-text pastes stay literal text.

## Markdown autoformat while typing

Typing Markdown converts live (disable with `autoformat="false"`):

- **Blocks** — a space after a line-start prefix converts the line: `-` / `*` / `+` start a bulleted list, `1.` a numbered list, `#`–`###` a heading of that level. Only when the prefix is the entire line so far, and never inside list items, table cells or code.
- **Inline** — typing the closing delimiter converts the run and leaves the caret _outside_ the mark: `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `__bold__`, `_italic_` (underscores never fire inside a word, so `snake_case` stays literal).

Autoformat is token-aware: characters registered as [trigger characters](#building-blocks-triggers) are reserved — with a `#` trigger configured, `# ` opens the autocomplete instead of becoming a heading — and all autoformat is suspended while a trigger popup is open.

## Undo and redo

The editor keeps its own history of the **Markdown value** and routes every undo affordance into it:
<kbd>Ctrl/Cmd+Z</kbd>, <kbd>Ctrl+Y</kbd> / <kbd>Ctrl/Cmd+Shift+Z</kbd>, the platform's own undo (the
macOS Edit menu, iOS shake-to-undo, an Android keyboard's undo key) and the `'undo'` / `'redo'`
toolbar tools, which disable themselves at the ends of the stack.

The browser's native `contenteditable` undo is deliberately never used. The editor rewrites the DOM
behind that stack's back — pasted HTML is normalized through the Markdown pipeline, autoformat turns
typed text into structure — so native undo can restore a DOM state the value model never had, or do
nothing at all.

- A burst of typing goes back **word by word**; each rewrite the editor performed itself (paste
  normalization, an autoformat conversion, a toolbar command, a token insert) goes back in **one**
  step.
- The caret returns to where it sat in the restored state.
- 100 states are kept; the oldest fall off the bottom.
- Writing `value` from outside — a form reset, or the multi-language switcher moving to another
  language — starts a **fresh** history, so undo can never reach back into a document the editor is
  no longer showing.

`canUndo()` / `canRedo()` and `undo()` / `redo()` are on the editor directive, for a custom toolbar.

## Choosing which tools appear

The toolbar is data-driven. Pass a `tools` input with an ordered list of tokens to pick and order
the controls. Tokens: `'undo'`, `'redo'`, `'bold'`, `'italic'`, `'underline'`, `'strike'`, `'code'`
(inline code), `'heading'` (the Normal / Heading 1–3 menu), `'bulletedList'`, `'numberedList'`,
`'link'`, plus the opt-in `'align'` and `'table'` (see below). `'divider'` renders a separator. Omit
`tools` for the full default toolbar.

```html
<et-rich-text-editor
  [formField]="demoForm.report"
  [tools]="['heading', 'divider', 'bold', 'italic', 'strike', 'divider', 'link']"
/>
```

To set the default for many editors at once, provide `provideRichTextEditorTools(...)` (a
per-instance `tools` input still wins). The selection (floating) toolbar automatically shows the
inline subset of the configured tools. It is a **pointer-device enhancement** — on touch devices it
is suppressed (the platform's own selection menu occupies that space), and the always-visible static
toolbar is used instead.

```ts
import { provideRichTextEditorTools } from '@ethlete/components';

providers: [provideRichTextEditorTools(['heading', 'divider', 'bold', 'italic', 'link'])];
```

Underline and inline code round-trip through the Markdown value (underline as native `<u>`, since
Markdown has no underline syntax).

## Links

The `'link'` tool opens a popover (not a browser prompt) to set a link's **text**, **URL** and
whether it should **open in a new tab**. New-tab links are stored in the Markdown value as raw HTML
(`<a href="…" target="_blank" rel="noopener noreferrer">…</a>`) since Markdown has no `target`
syntax; ordinary links stay `[text](url)`. The popover is used from both the main toolbar and the
selection (floating) toolbar, and pre-fills from the link under the caret when editing one. It is
responsive: an arrow'd popover anchored to the selection on wider screens, and a top sheet (pinned
above the on-screen keyboard) on small/touch screens.

## Opt-in tools: tables and alignment

The heavier tools are opt-in so their code (and UI) tree-shakes away when unused. Add the provider
and include its token in `tools`:

```ts
import { provideRichTextEditorTableTool, provideRichTextEditorAlignmentTool } from '@ethlete/components';

providers: [provideRichTextEditorTableTool(), provideRichTextEditorAlignmentTool()];
```

```html
<et-rich-text-editor [formField]="demoForm.report" [tools]="['heading', 'divider', 'align', 'table']" />
```

- **`'table'`** — a grid-size picker inserts a table (on touch, swipe across the grid to size it;
  with a keyboard, the arrow keys size the grid and <kbd>Enter</kbd> inserts); when the caret is
  inside one, the menu offers insert/delete row and column and delete table. When
  the header row has been deleted, the menu offers **Insert header row** instead of leaving the
  table headerless (a GFM pipe table always has a header, so on round-trip the first body row would
  be promoted into one). Tables round-trip as GFM pipe tables — a cell can
  only hold inline content, so the block tools (heading menu, lists) disable themselves while the
  caret is in a cell. The heading menu likewise disables inside list items (a heading has no
  serialized form there). Block alignment survives switching between paragraph and heading.
  Inside a table, <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> move to the next/previous cell; past the
  last (or before the first) cell the caret steps out of the table, and the arrow keys step
  in/out across the table's edges — so the keyboard never gets trapped in a table.
- **`'align'`** — a block-alignment menu (left / center / right / justify). Block alignment persists
  as a native `text-align` style (Markdown has no block-alignment syntax). Inside a table it applies
  to the whole column and persists as GFM column alignment (`:---`, `:---:`, `---:`). It disables
  inside lists, where alignment has no serialized form.

<StoryEmbed id="components-forms-rich-text-editor--with-table-and-alignment" height="440px" />

To register your own tool, provide a `RichTextEditorToolDefinition` (a toggle button, or a custom
control component) through the `RICH_TEXT_EDITOR_TOOL` multi-provider token.

## Building blocks (`#`/`@`/… triggers)

Opt in to Slack-style autocomplete by adding the `etRichTextEditorTriggers` directive and passing
domain-specific triggers. Typing a trigger character at a word boundary opens a caret-anchored
popup; picking an item inserts an atomic **token chip**. The whole feature (detection, popup,
async sources) lives in a separate directive, so editors that don't use it tree-shake it away —
spread `RICH_TEXT_EDITOR_TRIGGERS_IMPORTS` **in addition to** `RICH_TEXT_EDITOR_IMPORTS`.

```ts
import {
  createRichTextEditorTrigger,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
} from '@ethlete/components';

const MERGE_FIELDS = [
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
];

triggers = [
  // static list
  createRichTextEditorTrigger({
    char: '#',
    type: 'block',
    items: MERGE_FIELDS,
    resolveItem: (id) => MERGE_FIELDS.find((f) => f.id === id) ?? null,
  }),
  // search-as-you-type (Promise or Observable)
  createRichTextEditorTrigger({
    char: '@',
    type: 'mention',
    items: (query) => this.userService.search(query),
    resolveItem: (id) => this.userService.byId(id),
  }),
];
```

```html
<et-rich-text-editor [triggers]="triggers" [formField]="form.body" etRichTextEditorTriggers />
```

A picked item is stored in the Markdown value as <code v-pre>{{type:id}}</code> (e.g. <code v-pre>{{block:firstName}}</code>) and
rendered as a labelled chip. Chip labels are resolved from `resolveItem` at render time (the raw
id shows if there's no resolver), so they never go stale. The trigger character is never consumed:
it stays as literal text and the popup only opens at a word boundary — so `user@domain` in an
email never triggers, and pressing <kbd>Escape</kbd> dismisses the popup so you can keep typing the
literal character.

| `RichTextEditorTrigger` field | Type                                                 | Default | Notes                                                                                              |
| ----------------------------- | ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `char`                        | `string`                                             | —       | Character that opens the popup (unique per editor).                                                |
| `type`                        | `string`                                             | —       | Namespaces the token (<code v-pre>{{type:id}}</code>); must match `[a-z][a-z0-9-]*` and be unique. |
| `items`                       | array \| `(query) => items \| Promise \| Observable` | —       | Static arrays are filtered client-side; function sources own their filtering.                      |
| `resolveItem`                 | `(id) => item \| null \| Promise \| Observable`      | —       | Resolves a stored id to a chip label; omit to show the raw id.                                     |
| `allowSpaces`                 | `boolean`                                            | `false` | Keep the popup open when the query contains spaces.                                                |
| `minQueryLength`              | `number`                                             | `0`     | Minimum query length before items are requested.                                                   |
| `debounceTime`                | `number`                                             | `150`   | Debounce (ms) applied to async function sources.                                                   |

Item ids must match `[A-Za-z0-9._:-]+` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown
untouched (a dev-mode error is thrown otherwise). To render stored token values as chips in a
read-only/display context **without** the interactive picker, provide
`provideRichTextEditorTokenRendering(triggers)` on that component instead of the directive.

### Backing a trigger with `@ethlete/query`

For a [query](/query/queries)-backed trigger, use `createRichTextEditorTriggerWithQuery` — it owns
the search signal (writing the typed text so the query re-executes), maps the response to items, and
surfaces a query failure as the popup's error state. (`@ethlete/components` intentionally depends on
`@ethlete/query`, as `@ethlete/cdk` does; the factory is tree-shaken when unused.)

Like a [query stack](/query/stacks), pass the `queryCreator` plus a reactive `args` builder — the
query is created **once** and re-executes as the user types (the factory owns the search signal and
the `withArgs` feature, so you never write them):

```ts
import { createRichTextEditorTriggerWithQuery } from '@ethlete/components';

class Example {
  triggers = [
    createRichTextEditorTriggerWithQuery({
      char: '@',
      type: 'mention',
      queryCreator: searchUsers,
      // reactive: reading `search()` re-executes the query; return null to skip a request
      args: (search) => (search() ? { queryParams: { q: search() } } : null),
      toItems: (res) => res.items.map((u) => ({ id: u.id, label: u.name })),
      resolveItem: (id) => this.userById(id),
    }),
  ];
}
```

Call the factory from a field initializer or constructor (an injection context), the same place
you'd create a query or a query stack. Returning `null` from `args` (e.g. for an empty query) skips
the request, so the popup shows no results without hitting the backend. For a source other than a
query, use the generic `createRichTextEditorTrigger` with an `Observable`/`Promise` `items` function.

<StoryEmbed id="components-forms-rich-text-editor-triggers--default" height="460px" />

### Inserting tokens from your own UI

Apps often render their own placeholder/merge-field buttons _outside_ the editor. Instead of
appending token Markdown to the bound value (which lands at the end and resets the caret), insert a
token at the caret — the same result as picking one from the popup — with the editor's own codec and
label resolution. Grab the editor through its `etRichTextEditor` `exportAs` (or a
`viewChild(RichTextEditorDirective)`) and call one method:

- **`insertToken(type, id, opts?)`** — resolves the chip label via the matching trigger's
  `resolveItem`, builds the chip, and inserts it at the caret (or at the end when the editor isn't
  focused), leaving the caret after the chip. `opts.focus` (default `true`) refocuses the editor so
  the user can keep typing.
- **`insertTokenItem(type, item, opts?)`** — the same, for when you already hold the resolved
  `{ id, label }` (e.g. the row a button represents); the label is used as-is, skipping resolution.

```html
<et-rich-text-editor #rte="etRichTextEditor" [triggers]="triggers" etRichTextEditorTriggers />
<button (click)="rte.insertToken('placeholder', 'firstName')" type="button">First name</button>
```

A token codec must be installed — by `etRichTextEditorTriggers` or
`provideRichTextEditorTokenRendering(triggers)` — or the call throws in dev (tokens can't
(de)serialize without one).

### Built-in token palette

For a ready-made button row, drop in `et-rich-text-editor-token-palette`, driven by the same
`RichTextEditorTrigger[]`. Each available item becomes a tonal [`et-button`](/components/button)
that inserts its token on click, reusing the label resolution and caret handling above. Static item
sources list all their items; search-only sources (with `minQueryLength`) stay empty, since a
palette is a fixed set rather than a search.

```html
<et-rich-text-editor #rte="etRichTextEditor" [triggers]="triggers" etRichTextEditorTriggers />
<et-rich-text-editor-token-palette [editor]="rte" [triggers]="triggers" />
```

Import it via `RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS`. The **Token Palette** story under
_Rich Text Editor/Triggers_ shows it live.

| `et-rich-text-editor-token-palette` input | Type                      | Default      | Notes                                                         |
| ----------------------------------------- | ------------------------- | ------------ | ------------------------------------------------------------- |
| `editor`                                  | `RichTextEditorDirective` | — (required) | The editor to insert into (a template ref to its directive).  |
| `triggers`                                | `RichTextEditorTrigger[]` | `[]`         | The triggers whose items become chips (use the same array).   |
| `label`                                   | `string \| null`          | `null` ¹     | Accessible name for the palette group.                        |
| `focusEditorOnInsert`                     | `boolean`                 | `true`       | Focus the editor after inserting so the user can keep typing. |

¹ `null` falls through to [`RICH_TEXT_EDITOR_LABELS.insertToken`](/components/localization) (`'Insert token'`).

## Multi-language rich text editor

`et-multi-language-rich-text-editor` wraps the editor above to author the same content in several
languages. Its value is a **`Record<languageCode, markdown>`** (one form field holds every
translation), and a switcher in the toolbar changes which language you edit. The language list is
consumer-provided — nothing is hard-wired — so pass a required `languages` array:

```html
<et-form-field>
  <et-label>Description</et-label>
  <et-multi-language-rich-text-editor
    [formField]="demoForm.translations"
    [languages]="[
      { code: 'en', label: 'English' },
      { code: 'de', label: 'Deutsch' },
      { code: 'fr', label: 'Français' },
    ]"
  />
</et-form-field>
```

```ts
// the field value groups all translations
demoForm.translations().value(); // { en: '# Hello', de: '# Hallo', fr: '' }
```

Each language `{ code, label, icon? }` maps its Markdown under `code`; the first language is active
initially. It embeds a plain `et-rich-text-editor`, so `tools`, `autoformat`, `placeholder` and the
field chrome all work the same — the switcher tool is prepended to the toolbar automatically.

**Seeing which languages still need content.** The toolbar switcher shows the active language code
with a badge dot while any language is empty. Opening it marks the active language with a leading
check and shows a trailing status dot per language — solid when it has content, hollow while it is
still empty. Emptiness is "trimmed Markdown is blank", so it reflects real content, not just edits.
Translations stored under a code not in `languages` are preserved untouched (never dropped) and
don't affect the status counts.

<StoryEmbed id="components-forms-rich-text-editor-multi-language--with-existing-translations" height="420px" />

**Requiring translations.** To make specific languages mandatory, add the exported `requiredLanguages`
validator to your `form()` schema — a missing translation then surfaces as a normal form-field error,
the same channel every other control uses:

```ts
import { requiredLanguages } from '@ethlete/components';

demoForm = form(this.model, (s) => {
  requiredLanguages(s.translations, { codes: ['en', 'de'] });
});
```

## Localization

Every string the editor renders — both toolbars' names, each tool, the block-style menu, the link
editor's fields and actions, and the table/alignment menus — comes from `RICH_TEXT_EDITOR_LABELS`.
Override it app-wide, or per editor with the `labels` input:

```ts
provideRichTextEditorLabels({
  toolbar: 'Textformatierung',
  bold: 'Fett',
  heading: (level) => `Überschrift ${level}`,
  linkEditorAdd: 'Link hinzufügen',
});
```

The tool keys (`bold`, `italic`, `link`, `align`, `table`, `language`, …) are named after their tool
tokens, which is how the toolbar looks a button's name up. A tool **your** app registers through
`RICH_TEXT_EDITOR_TOOL` keeps the `label` on its own definition instead — you wrote that string, so
it is already in your language. See the [localization guide](/components/localization).

## Accessibility

The editable region is a `role="textbox" aria-multiline="true"` and inherits the field shell's
`aria-describedby` / `aria-labelledby` / `*`-marker wiring, so errors and hints work exactly as they
do for [text fields](/components/forms#validation-accessibility). Toolbar buttons expose their
pressed state — buttons that open a menu or popover (block style, alignment, table, link) also show
it while their popover is open (announced via `aria-expanded`, not `aria-pressed`, for the menu
triggers). Undo and redo are actions rather than toggles, so they never report a pressed state; they
are `disabled` when there is nothing to take back or replay. The floating toolbar is a pointer-only enhancement and never removes an action that
isn't also reachable from the always-visible static toolbar.

The toolbar follows the [ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/):
it is a single tab stop. Tab moves focus into it (onto the last-used button),
<kbd>ArrowLeft</kbd>/<kbd>ArrowRight</kbd> move between buttons (wrapping at the ends,
<kbd>Home</kbd>/<kbd>End</kbd> jump to the first/last), and pressing Tab again moves on to the
editor content instead of stepping through every button.

## Theming

Public design tokens, overridable in your CSS scope — all colors resolve through the
[surface/color theme systems](/core/theming):

| Component                            | Tokens                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `et-rich-text-editor`                | `--et-rich-text-editor-toolbar-gap`, `-toolbar-padding`, `-button-radius`, `-min-height`, `-content-gap`, `-token-radius`, `-token-padding-inline` |
| `et-rich-text-editor-link-editor`    | `--et-rich-text-editor-link-editor-width`, `-radius`, `-gap`, `-padding`                                                                           |
| `et-rich-text-editor-token-palette`  | `--et-rich-text-editor-token-palette-gap` (buttons follow the `et-button` `tonal` variant)                                                         |
| `et-multi-language-rich-text-editor` | `--et-multi-language-rich-text-editor-badge-size` (plus every `et-rich-text-editor` token, inherited by the embedded editor)                       |

## Error codes

The trigger/token building blocks throw [`ET25xx`](/components/error-codes#rich-text-editor-et25xx)
in dev mode (duplicate trigger char/type, invalid token type/id, triggers used outside an editor, or
`insertToken` called with no token codec installed).
