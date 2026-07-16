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
| `loading`           | `boolean`                            | `false`      | Shows a loading row in the panel (override with `ng-template[etSelectLoading]`).                                                                            |
| `error`             | `string \| null`                     | `null`       | Shows an error row in the panel (override with `ng-template[etSelectError]`, error text as context).                                                        |
| `hasMoreItems`      | `boolean`                            | `false`      | Shows a load-more control emitting `loadMoreRequested` (label via `loadMoreLabel`).                                                                         |

| Output              | Payload  | Emitted when                                |
| ------------------- | -------- | ------------------------------------------- |
| `queryChange`       | `string` | The search query changes (every keystroke). |
| `loadMoreRequested` | `void`   | The load-more control is activated.         |

On `et-select-option`:

| Input      | Type      | Default | Description                                                                   |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `value`    | `unknown` | —       | Required. The value this option commits.                                      |
| `label`    | `string`  | `''`    | Display label for the trigger and typeahead; falls back to the rendered text. |
| `disabled` | `boolean` | `false` | Skipped by keyboard navigation, not committable.                              |

The trigger resolves the selected value's label from the options — including a preselected value that was set programmatically before the panel ever opened. Values are compared with reference equality; for object values, bind the same instances you set as `value`.

## Multi-select

<StoryEmbed id="components-forms-select--multiple" height="420px" />

With `multiple`, each selected value renders as a removable chip in the trigger; a chip's remove button (or Backspace/Delete on a chip) deselects that value without opening the panel, and the chips row wraps, growing the field. Committing an option toggles it and keeps the panel open — Escape, Tab or clicking outside close it.

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

Opt into search by projecting an `<input etSelectSearch />` — it renders **inline in the field** (combobox pattern): in multi mode it flows after the chips, tag-input style; in single mode **the input doubles as the value display** — it shows the selected label, which gets text-selected on open so typing replaces it, and is restored when the panel closes. The input becomes the field's tab stop and takes over the combobox ARIA from the trigger. Typing opens the panel; with the default `filterMode="internal"` it hides non-matching options (case-insensitive label match), and when nothing matches the panel shows an empty row (override with `ng-template[etSelectEmpty]`). The first <kbd>Escape</kbd> clears the query, the second closes the panel; the query also clears when the panel closes or a multi commit adds a value. Clicking into the input never closes the panel — the chevron toggles it. The panel animates its block size when content changes while open (filtering, async results).

### Async options

<StoryEmbed id="components-forms-select--async-options" height="420px" />

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

Clicking the trigger toggles the panel; clicking outside or on the trigger while open closes it.

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
