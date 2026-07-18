# Select

`et-select` is a signal-forms-native dropdown select: a combobox-pattern trigger that opens an anchored listbox panel, with full keyboard support and virtual option focus. Multi-select renders the selection as removable [chips](/components/chip) in the trigger, and an optional search input turns it into a searchable combobox — filtering client-side data itself or driving an async option source (e.g. via [@ethlete/query](/query/)). It uses the same field shell as the other [form controls](/components/forms) and imports as `SELECT_IMPORTS`. This is the unified replacement for the legacy cdk `select`/`combobox` pair.

```ts
import { SELECT_IMPORTS } from '@ethlete/components';
```

```html
<et-form-field>
  <et-label>Fruit</et-label>
  <et-select [formField]="demoForm.fruit" placeholder="Pick a fruit">
    @for (fruit of fruits; track fruit.value) {
    <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
    }
  </et-select>
</et-form-field>
```

## Live demo

<StoryEmbed id="components-forms-select--default" height="420px" />

## Options

On `et-select` (forwarded from the headless `[etSelect]` directive), plus the standard form-field contract set (`disabled`, `readonly`, `invalid`, `errors`, `required`, `name`, `touched`):

| Input               | Type                                 | Default      | Description                                                                                                                                                 |
| ------------------- | ------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`             | `unknown \| unknown[] \| null`       | `null`       | The selected option's value. Two-way bindable.                                                                                                              |
| `open`              | `boolean`                            | `false`      | Whether the panel is open. Two-way bindable.                                                                                                                |
| `placeholder`       | `string`                             | `''`         | Shown in the trigger while nothing is selected.                                                                                                             |
| `multiple`          | `boolean`                            | `false`      | Multi-select: `value` is an array, options toggle (the panel stays open) and the trigger renders removable chips.                                           |
| `filterMode`        | `'none' \| 'internal' \| 'external'` | `'internal'` | How a search query filters: `internal` hides non-matching options, `external` leaves the option list to you (react to `queryChange`), `none` never filters. |
| `allowCustomValues` | `boolean`                            | `false`      | Enter with a query that matches no option commits the raw string as the value.                                                                              |
| `allowAddNew`       | `boolean`                            | `false`      | Renders an "Add new" action row at the end of the panel that emits `addNewRequested` (label via `addNewLabel`).                                             |
| `loading`           | `boolean`                            | `false`      | Shows a spinner in the field and a loading row in the panel (override the row with `ng-template[etSelectLoading]`).                                         |
| `error`             | `string \| null`                     | `null`       | Shows an error row in the panel (override with `ng-template[etSelectError]`, error text as context).                                                        |
| `hasMoreItems`      | `boolean`                            | `false`      | Shows a load-more control emitting `loadMoreRequested` (label via `loadMoreLabel`).                                                                         |

| Output              | Payload  | Emitted when                                                                              |
| ------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `queryChange`       | `string` | The search query changes (every keystroke).                                               |
| `loadMoreRequested` | `void`   | The load-more control is activated.                                                       |
| `addNewRequested`   | `string` | The add-new row is picked; the payload is the current search query (prefill your dialog). |

On `et-select-option`:

| Input      | Type      | Default | Description                                                                   |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `value`    | `unknown` | —       | Required. The value this option commits.                                      |
| `label`    | `string`  | `''`    | Display label for the trigger and typeahead; falls back to the rendered text. |
| `disabled` | `boolean` | `false` | Skipped by keyboard navigation, not committable.                              |

The trigger resolves the selected value's label from the options — including a preselected value that was set programmatically before the panel ever opened. Values are compared with reference equality; for object values, bind the same instances you set as `value`.

## Multi-select

<StoryEmbed id="components-forms-select--multiple" height="420px" />

With `multiple`, each selected value renders as a removable chip in the trigger; a chip's remove button (or Backspace/Delete on a chip) deselects that value without opening the panel, and the chips row wraps, growing the field. Committing an option toggles it and keeps the panel open — Escape, Tab or clicking outside close it. While `readonly`, the chips keep their normal (non-disabled) look but drop the remove button; while `disabled`, they render dimmed without it.

### Custom trigger value

Replace the default label/chips display entirely by projecting an `ng-template[etSelectValue]` — it renders inside the trigger with the selected items as context:

```html
<et-select [formField]="demoForm.fruits" multiple>
  <ng-template etSelectValue let-items>{{ items.length }} fruits picked</ng-template>

  @for (fruit of fruits; track fruit.value) {
  <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
  }
</et-select>
```

## Headless composition

The Tier 3 component wires `[etSelect]` + `[etSelectTrigger]` + `ng-template[etSelectSurface]` + `[etSelectListbox]` + `[etSelectOption]`. Compose them directly for custom markup — the surface template mounts into an anchored overlay (mirroring the anchor's width) when the select opens:

```html
<div #select="etSelect" [(value)]="value" etSelect>
  <button etSelectTrigger type="button">{{ select.displayValue() ?? 'Pick one' }}</button>

  <ng-template etSelectSurface>
    <et-select-panel>
      <div etSelectOption value="a">Option A</div>
      <div etSelectOption value="b">Option B</div>
    </et-select-panel>
  </ng-template>
</div>
```

`et-select-panel` provides the styled panel chrome (it carries the `[etSelectListbox]` role and re-applies the surface/color theme context inside the detached overlay pane). One caveat for fully custom surfaces: options inside a lazy `ng-template` only bind once rendered, so a preselected value's label resolves after the first open. `et-select` avoids this by keeping the projected options rendered (hidden) while closed.

## Search

<StoryEmbed id="components-forms-select--searchable" height="420px" />

In a headless composition, `etSelectSearch` can also live inside the surface template (in the panel) — there it acts as a pure query box that always shows its placeholder, like the [menu](/components/menu)'s search (the phone input's country picker works this way).

Opt into search by projecting an `<input etSelectSearch />` — it renders **inline in the field** (combobox pattern): in multi mode it flows after the chips, tag-input style; in single mode **the input doubles as the value display** — it shows the selected label, which gets text-selected on open so typing replaces it, and is restored when the panel closes. The input becomes the field's tab stop and takes over the combobox ARIA from the trigger. Typing opens the panel; with the default `filterMode="internal"` it hides non-matching options (case-insensitive label match), and when nothing matches the panel shows an empty row (override with `ng-template[etSelectEmpty]`). The first <kbd>Escape</kbd> clears the query, the second closes the panel; the query also clears when the panel closes or a multi commit adds a value. Clicking into the input never closes the panel — the chevron toggles it. The panel animates its block size when content changes while open (filtering, async results).

### Async options

Try it live in Storybook: `Components/Forms/Select` → `Async options`.

With `filterMode="external"` the select never hides options itself — react to `(queryChange)`, drive your data source and render the options with an `@for`. Bind `loading`, `error` and `hasMoreItems` for the panel's async states. `selectOptionsFromQuery` wires an `@ethlete/query` query up in one call:

```ts
users = selectOptionsFromQuery({
  queryCreator: searchUsers,
  args: (query) => (query() ? { queryParams: { q: query() } } : null),
  toOptions: (res) => res.items,
});
```

```html
<et-select
  [formField]="form.assignee"
  [loading]="users.loading()"
  [error]="users.error()"
  (queryChange)="users.setQuery($event)"
  filterMode="external"
>
  <input etSelectSearch placeholder="Search users" />
  @for (user of users.options(); track user.id) {
  <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
  }
</et-select>
```

The factory debounces the query (`debounceTime`, default 300ms), skips requests below `minQueryLength`, and maps failures to the error row's text (`toErrorMessage`). Pagination: derive `hasMore` from the response via `toHasMore` and grow your page size on `(loadMoreRequested)`. To preload options so the panel isn't empty on first open, let `args` return request args for the empty query (return `null` instead to require a query first).

### Custom values

With `allowCustomValues`, <kbd>Enter</kbd> on a query that matches no option commits the raw string — in multi mode it becomes a chip and the search clears, covering tag-input-style flows.

Prefer this over [`et-tag-input`](/components/forms#tag-input-—-et-tag-input) whenever suggestions/autocomplete are involved: the tag input is the plain free-text variant (separators, paste splitting, `maxTags`) with no option list, while a multi custom-value select is the same UX **plus** options.

### Adding new options

With `allowAddNew`, the panel ends in a distinct "Add new" action row (label via `addNewLabel`). Picking it emits `(addNewRequested)` with the current search query and closes the panel — open a creation dialog (or create inline), then set the new value yourself:

```html
<et-select [formField]="form.project" (addNewRequested)="openCreateProjectDialog($event)" allowAddNew>
  <input etSelectSearch placeholder="Search projects" />
  @for (project of projects(); track project.id) {
  <et-select-option [value]="project.id">{{ project.name }}</et-select-option>
  }
</et-select>
```

Unlike `allowCustomValues` (which commits the raw query string directly), the add-new flow leaves creating the value entirely to you — use it when new entries need real backing data. See the `AddNewOption` story for a working example.

## Option groups

Wrap options in `et-select-option-group` to render labelled sections in the listbox — filter bars, categorized lists. Grouping is purely presentational: options still register flat, so keyboard navigation and typeahead run across the whole list regardless of section.

```html
<et-select [formField]="form.player" filterMode="internal">
  <input etSelectSearch placeholder="Search players" />
  <et-select-option-group label="Forwards">
    <et-select-option value="mbappe">Kylian Mbappé</et-select-option>
    <et-select-option value="haaland">Erling Haaland</et-select-option>
  </et-select-option-group>
  <et-select-option-group label="Midfielders">
    <et-select-option value="bellingham">Jude Bellingham</et-select-option>
  </et-select-option-group>
</et-select>
```

Each group is a `role="group"` with `aria-labelledby` pointing at its header. With `filterMode="internal"` a group **hides itself once all of its options are filtered out**, so search never leaves an empty section header behind. The design token `--et-select-option-group-label-font-size` (default `12px`) sizes the header. For custom markup, the headless `[etSelectOptionGroup]` directive works the same way — set `label` (used for `aria-label` when no header element registers) around your projected `[etSelectOption]`s.

<StoryEmbed id="components-forms-select-option-group--default" height="360px" />

## Large option lists

Options render with `content-visibility: auto`, so offscreen rows skip layout and paint entirely — a panel with a few thousand projected options stays responsive while scrolling and filtering (see the `ManyOptions` story with 2000 options). Angular still creates every option instance, so for very large or unbounded datasets prefer the [async options](#async-options) pattern: filter server-side via `filterMode="external"` and page with `hasMoreItems`/`loadMoreRequested` instead of rendering everything.

## Keyboard interaction

Focus stays on the trigger the whole time; options receive _virtual_ focus, exposed via `aria-activedescendant`.

| Key                                       | Closed                                                                | Open                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| <kbd>Enter</kbd> / <kbd>Space</kbd>       | Opens the panel                                                       | Commits the active option and closes (multi: toggles it, stays open) |
| <kbd>ArrowDown</kbd> / <kbd>ArrowUp</kbd> | Opens the panel                                                       | Moves virtual focus (no wrap)                                        |
| <kbd>Home</kbd> / <kbd>End</kbd>          | —                                                                     | First / last enabled option                                          |
| <kbd>Escape</kbd>                         | —                                                                     | Closes without committing                                            |
| <kbd>Tab</kbd>                            | Moves focus on                                                        | Closes, focus moves on                                               |
| Printable characters                      | Commits the first matching option directly (like a native `<select>`) | Moves virtual focus to the first match                               |

Clicking anywhere on the form field's control frame — not just the trigger — opens the panel (the frame is the visual "input box", so all of it is clickable); clicking outside while open closes it. Hovering an option moves virtual focus to it, and the pointer highlight clears when the pointer leaves the list (like in the [menu](/components/menu)) — a keyboard-set highlight stays visible without hover.

## Accessibility

- The trigger is a `role="combobox"` element with `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` (the listbox id while open) and `aria-activedescendant` (the active option while open). It is not a native `<button>` — chips carry remove buttons, and buttons cannot nest — so the trigger directive manages `tabindex` (`0`, `-1` while disabled) and `aria-disabled` itself. It is labelled by the form field's `et-label` plus its own content, and carries `aria-required`/`aria-invalid`/`aria-describedby` from the form-field wiring. **With an inline search input, the input takes over the combobox role and all of this wiring** — the trigger element becomes a plain container.
- The panel content is a `role="listbox"` (`aria-multiselectable` when `multiple`); options are `role="option"` with `aria-selected`, `aria-disabled` and stable ids. Options are never tab stops, and neither are the chips or their remove buttons.
- The panel opens without moving DOM focus and closing restores nothing — focus simply never left the trigger.
- `touched` is set on trigger blur, so errors display after the user leaves the field.
- Dev mode throws when the trigger or surface is missing, or when a sub-directive is placed outside `[etSelect]`.

## Theming

The trigger inherits the form field's chrome (border, focus ring, sizes, label modes — including floating labels). Colors come from the app-registered [surface/color theme systems](/core/theming); the panel re-applies the trigger location's theme context inside the overlay and elevates the surface one step. Public design tokens:

| Token                               | Default | Purpose                          |
| ----------------------------------- | ------- | -------------------------------- |
| `--et-select-arrow-size`            | `16px`  | Trigger chevron size             |
| `--et-select-panel-max-height`      | `40vh`  | Panel max height (scrolls)       |
| `--et-select-panel-padding`         | `6px`   | Panel inner padding              |
| `--et-select-option-height`         | `36px`  | Option row min height            |
| `--et-select-option-padding-inline` | `10px`  | Option horizontal padding        |
| `--et-select-option-gap`            | `8px`   | Gap between check icon and label |
| `--et-select-option-border-radius`  | `6px`   | Option row corner radius         |
| `--et-select-option-font-size`      | `14px`  | Option font size                 |
| `--et-select-option-check-size`     | `16px`  | Selected check icon size         |

## Error codes

The select domain owns the `ET1000`–`ET1099` range — see [error codes](/components/error-codes#select-et10xx).
