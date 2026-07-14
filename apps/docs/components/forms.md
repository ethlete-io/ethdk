# Forms

Signal-forms-native form controls: input, checkbox, switch, selection lists and a rich text editor, plus the shared field chrome (labels, hints, errors, affixes) that wires accessibility for you. For file uploads, see the [dropzone](/components/dropzone) guide.

::: info Signal forms only
These controls implement Angular's [signal forms](https://angular.dev/guide/forms) contracts (`FormValueControl` / `FormCheckboxControl`) and bind via `[formField]` from `@angular/forms/signals`. There is no `ngModel`/`ControlValueAccessor` layer — the classic stack (and specialized date/number/masked inputs) lives only in the legacy `@ethlete/cdk`. Two-way `[(value)]` / `[(checked)]` also works for simple cases.
:::

```ts
private formModel = signal({ email: '' });

protected demoForm = form(this.formModel, (s) => {
  required(s.email, { message: 'Email is required' });
});
```

## Importing

Each control family ships its own imports array — combine the field shell with the controls you use:

| Array                      | Contains                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `FORM_FIELD_IMPORTS`       | `et-form-field`, `et-label`, `et-hint`, `etInputPrefix` / `etInputSuffix` |
| `INPUT_IMPORTS`            | `et-input`                                                                |
| `CHECKBOX_IMPORTS`         | `et-checkbox`                                                             |
| `SWITCH_IMPORTS`           | `et-switch`                                                               |
| `CHOICE_FIELD_IMPORTS`     | `et-choice-field` + label/hint chrome                                     |
| `RICH_TEXT_EDITOR_IMPORTS` | `et-rich-text-editor`                                                     |

```ts
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
```

The selection-list groups have no aggregate array — import the components directly (`CheckboxGroupComponent` + `CheckboxOptionComponent`, `RadioGroupComponent` + `RadioComponent`, `SegmentedButtonGroupComponent` + `SegmentedButtonComponent`), and the same goes for `DescriptionComponent` (`et-description`).

## Text fields — `et-form-field` + `et-input`

The form field renders the shell (label, prefix/suffix affixes via `etInputPrefix` / `etInputSuffix`, hint/error support region); the control registers itself into it via DI — no manual wiring:

```html
<et-form-field appearance="box" labelMode="floating-inside">
  <et-label>Email</et-label>
  <span etInputPrefix>@</span>
  <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
  <et-hint>We never share your email.</et-hint>
</et-form-field>
```

<StoryEmbed id="components-forms-input--default" height="320px" />

Field shell variants (as `data-*`-reflected inputs on `et-form-field`):

| Input        | Values                                                            | Default         |
| ------------ | ----------------------------------------------------------------- | --------------- |
| `appearance` | `'box' \| 'underline'`                                            | `'box'`         |
| `fill`       | `'transparent' \| 'filled'`                                       | `'transparent'` |
| `labelMode`  | `'static' \| 'inline' \| 'floating-inside' \| 'floating-outside'` | `'static'`      |
| `size`       | `'sm' \| 'md' \| 'lg'`                                            | `'md'`          |

Only `fill: 'filled'` paints a surface behind the control, so only a filled field raises the surface elevation for its contents (and for overlays anchored inside it, such as the rich text editor's autocomplete). A `transparent` field stays flush with its parent surface.

`et-input` supports `type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'`, `placeholder`, `autocomplete`, `textAlign`, and the shared control state (`disabled`, `readonly`, `invalid`, `required`, …). There is no textarea — multi-line content is the rich text editor's job.

A **read-only** text field (set `readonly` in the field schema) keeps its normal box but drops every interactive affordance — no hover/focus border change, default cursor, full-contrast value — so it reads as view-only content. This is distinct from **disabled**, which stays dimmed.

## Checkbox & switch — `et-choice-field`

Boolean controls pair with a label inside `et-choice-field` (instead of `et-form-field`):

```html
<et-choice-field>
  <et-checkbox [formField]="demoForm.acceptTerms" />
  <et-label>I accept the terms and conditions</et-label>
</et-choice-field>

<et-choice-field>
  <et-switch [formField]="demoForm.notifications" />
  <et-label>Email notifications</et-label>
</et-choice-field>
```

- `et-checkbox` — `role="checkbox"`, `checked` + `indeterminate` models (`aria-checked="mixed"` when indeterminate; toggling an indeterminate checkbox resolves to checked).
- `et-switch` — `role="switch"`, `checked` model, no indeterminate.
- Both toggle on click and <kbd>Space</kbd>, and mark themselves touched on blur.
- `et-choice-field` accepts `size: 'sm' | 'md' | 'lg'` (default `'md'`), scaling the control and label together.

<StoryEmbed id="components-forms-switch--default" height="260px" />

## Selection lists

Three group flavors over one selection engine — options are projected children, keyboard navigation is roving-tabindex with wrapping arrows:

| Group                       | Options               | Mode     | Value        |
| --------------------------- | --------------------- | -------- | ------------ |
| `et-checkbox-group`         | `et-checkbox-option`  | multiple | array        |
| `et-radio-group`            | `et-radio`            | single   | single value |
| `et-segmented-button-group` | `et-segmented-button` | single   | single value |

```html
<et-radio-group [formField]="demoForm.color">
  <et-label>Favorite color</et-label>
  @for (option of options(); track option.value) {
  <et-radio [value]="option.value">{{ option.label }}</et-radio>
  }
  <et-hint>Pick one.</et-hint>
</et-radio-group>
```

- The group label is a projected `et-label` — it renders the `*` marker when the group is `required` and wires `aria-labelledby`. A plain `<span class="et-<group>-label">` also works for text-only labels.
- All three groups accept `size: 'sm' | 'md' | 'lg'` (default `'md'`), matching the `et-form-field` size scale.
- The segmented button group renders its options on a tonal track; the filled active pill animates between options on selection.

Checkbox options and radios accept an `et-description` child for secondary text, and the headless layer offers a tri-state "select all" control (`[etSelectionListControl]`).

<StoryEmbed id="components-forms-selection-list-segmented-button-group--default" height="280px" />

## Rich text editor

`et-rich-text-editor` is a Markdown-valued editor built on `contenteditable` (no ProseMirror dependency): the `value` model is **Markdown**, converted to/from HTML internally. It ships a static toolbar (block-style menu, bold, italic, underline, strikethrough, inline code, lists, links) plus a floating toolbar over the active selection, and uses the same field shell as text inputs:

```html
<et-form-field>
  <et-label>Match report</et-label>
  <et-rich-text-editor [formField]="demoForm.report" placeholder="Write something…" />
</et-form-field>
```

The editable region is a `role="textbox" aria-multiline="true"` with full invalid/described-by wiring. In a list, **Tab** / **Shift+Tab** nest and un-nest the current item (marker style cycles by depth), and **Enter** / **Backspace** on an empty item step out one level at a time.

<StoryEmbed id="components-forms-rich-text-editor--default" height="420px" />

### Choosing which tools appear

The toolbar is data-driven. Pass a `tools` input with an ordered list of tokens to pick and order
the controls. Tokens: `'bold'`, `'italic'`, `'underline'`, `'strike'`, `'code'` (inline code),
`'heading'` (the Normal / Heading 1–3 menu), `'bulletedList'`, `'numberedList'`, `'link'`, plus the
opt-in `'align'` and `'table'` (see below). `'divider'` renders a separator. Omit `tools` for the
full default toolbar.

```html
<et-rich-text-editor
  [formField]="demoForm.report"
  [tools]="['heading', 'divider', 'bold', 'italic', 'strike', 'divider', 'link']"
/>
```

To set the default for many editors at once, provide `provideRichTextEditorTools(...)` (a
per-instance `tools` input still wins). The selection (floating) toolbar automatically shows the
inline subset of the configured tools.

```ts
import { provideRichTextEditorTools } from '@ethlete/components';

providers: [provideRichTextEditorTools(['heading', 'divider', 'bold', 'italic', 'link'])];
```

Underline and inline code round-trip through the Markdown value (underline as native `<u>`, since
Markdown has no underline syntax).

### Opt-in tools: tables and alignment

The heavier tools are opt-in so their code (and UI) tree-shakes away when unused. Add the provider
and include its token in `tools`:

```ts
import { provideRichTextEditorTableTool, provideRichTextEditorAlignmentTool } from '@ethlete/components';

providers: [provideRichTextEditorTableTool(), provideRichTextEditorAlignmentTool()];
```

```html
<et-rich-text-editor [formField]="demoForm.report" [tools]="['heading', 'divider', 'align', 'table']" />
```

- **`'table'`** — a grid-size picker inserts a table; when the caret is inside one, the menu offers
  insert/delete row and column and delete table. Tables round-trip as GFM pipe tables.
- **`'align'`** — a block-alignment menu (left / center / right / justify), also usable inside table
  cells. Alignment persists as a native `text-align` style (Markdown has no alignment syntax).

To register your own tool, provide a `RichTextEditorToolDefinition` (a toggle button, or a custom
control component) through the `RICH_TEXT_EDITOR_TOOL` multi-provider token.

### Building blocks (`#`/`@`/… triggers)

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

#### Backing a trigger with `@ethlete/query`

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

## Validation & accessibility

The field chrome handles error display and aria wiring uniformly:

- Errors show once a control is **touched and invalid** — each signal-forms `ValidationError` renders as an `et-form-error` in the support region (`aria-live="polite"`), replacing the hint with an animated transition. While erroring, the field forces the app's error color theme (the theme registered with `type: 'error'`).
- `aria-describedby` on the control automatically points at the active error (or hint), `aria-labelledby` at the `et-label`; the label renders a `*` marker when the control is `required`.
- Dev mode throws an actionable error ([`ET2200`](/components/error-codes#form-field-et22xx)) if an `et-form-field` contains no control.

## Theming

Every control family declares public design tokens; override them in your CSS scope:

| Component                                           | Tokens                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `et-form-field`                                     | `--et-form-field-gap`, `-control-border-radius` / `-border-width` / `-padding-block` / `-padding-inline` / `-font-size` / `-line-height` / `-affix-gap` / `-disabled-opacity` / `-min-height`, `-label-font-size`, `-error-font-size`, `-hint-font-size`, `-support-duration`, `-support-offset` |
| `et-checkbox`                                       | `--et-checkbox-size`, `-border-radius`, `-border-width`, `-transition-duration`, `-opacity-disabled`                                                                                                                                                                                             |
| `et-switch`                                         | `--et-switch-track-width`, `-track-height`, `-thumb-size`, `-thumb-offset`, `-transition-duration`, `-opacity-disabled`                                                                                                                                                                          |
| `et-choice-field`                                   | `--et-choice-field-gap`, `-support-duration`, `-support-offset`, `-label-font-size`, `-error-font-size`, `-hint-font-size`                                                                                                                                                                       |
| `et-radio-group` / `et-radio`                       | `--et-radio-group-*` (gap, label/error/hint sizes, support), `--et-radio-size`, `-dot-size`, `-border-width`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                                                |
| `et-checkbox-group` / `et-checkbox-option`          | `--et-checkbox-group-*` (gap, label/error/hint sizes, support), `--et-checkbox-option-size`, `-border-width`, `-border-radius`, `-transition-duration`, `-opacity-disabled`, `-gap`                                                                                                              |
| `et-segmented-button-group` / `et-segmented-button` | `--et-segmented-button-group-*` (gap, label/error/hint sizes, support, `-track-padding`, `-track-radius`), `--et-segmented-button-padding-x` / `-padding-y`, `-border-radius`, `-transition-duration`, `-opacity-disabled`                                                                       |
| `et-rich-text-editor`                               | `--et-rich-text-editor-toolbar-gap`, `-toolbar-padding`, `-button-radius`, `-min-height`, `-content-gap`, `-token-radius`, `-token-padding-inline`                                                                                                                                               |

All colors resolve through the [surface/color theme systems](/core/theming) (the error state forces the theme registered with `type: 'error'`).

## Error codes

An `et-form-field` without a control throws [`ET2200`](/components/error-codes#form-field-et22xx) in dev mode.
