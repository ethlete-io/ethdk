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

| Input               | Type                                 | Default      | Description                                                                                                                                                                                                               |
| ------------------- | ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`             | `unknown \| unknown[] \| null`       | `null`       | The selected option's value. Two-way bindable.                                                                                                                                                                            |
| `open`              | `boolean`                            | `false`      | Whether the panel is open. Two-way bindable.                                                                                                                                                                              |
| `mixed`             | `boolean`                            | `false`      | Presents an unresolved bulk-edit selection independently of `value`. Two-way bindable; a user commit or clear resolves it to `false`.                                                                                     |
| `mixedLabel`        | `string`                             | `'Mixed'`    | Value text shown while `mixed` is true.                                                                                                                                                                                   |
| `placeholder`       | `string`                             | `''`         | Shown in the trigger while nothing is selected.                                                                                                                                                                           |
| `options`           | `SelectOptionData[] \| null`         | `null`       | Data-driven options (`{ value, label, disabled? }`) — the select renders and virtualizes the rows itself. See [large option lists](#large-option-lists-virtualization).                                                   |
| `multiple`          | `boolean`                            | `false`      | Multi-select: `value` is an array, options toggle (the panel stays open) and the trigger renders removable chips.                                                                                                         |
| `filterMode`        | `'none' \| 'internal' \| 'external'` | `'internal'` | How a search query filters: `internal` hides non-matching options, `external` leaves the option list to you (react to `queryChange`), `none` never filters.                                                               |
| `allowCustomValues` | `boolean`                            | `false`      | Enter with a query that matches no option commits the raw string as the value.                                                                                                                                            |
| `pickOnly`          | `boolean`                            | `false`      | Single-select command picker: committing an option emits `pickOption` and never writes `value`, so the select stays empty. See [command picker](#command-picker).                                                         |
| `allowAddNew`       | `boolean`                            | `false`      | Renders an "Add new" action row at the end of the panel that emits `addNew` (label via `addNewLabel`).                                                                                                                    |
| `loading`           | `boolean`                            | `false`      | Shows a spinner in the field and a loading row in the panel (override the row with `ng-template[etSelectLoading]`).                                                                                                       |
| `error`             | `string \| null`                     | `null`       | Shows an error row in the panel (override with `ng-template[etSelectError]`, error text as context).                                                                                                                      |
| `hasMoreItems`      | `boolean`                            | `false`      | Shows a load-more control emitting `loadMore` (label via `loadMoreLabel`).                                                                                                                                                |
| `mirrorPanelWidth`  | `boolean`                            | `true`       | Panel matches the field's width. Set `false` for a compact trigger (page size, country code) whose option rows need more room than the field — the panel then sizes to its content, capped at `min(400px, 100vw - 24px)`. |

| Output        | Payload   | Emitted when                                                                                                                                |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `mixedChange` | `boolean` | A user commit or clear resolves the controlled mixed state.                                                                                 |
| `queryChange` | `string`  | The search query changes (every keystroke).                                                                                                 |
| `loadMore`    | `void`    | The load-more control is activated.                                                                                                         |
| `addNew`      | `string`  | The add-new row is picked; the payload is the current search query (prefill your dialog).                                                   |
| `pickOption`  | `unknown` | A single-select option is committed; the payload is the picked value. With `pickOnly` this is the only pick signal (`value` never changes). |

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

## Mixed values in bulk editors

Try it live in Storybook: `Components/Forms/Select` → `Mixed` / `Mixed multiple`.

Use `mixed` when one select edits several records whose current values differ — the select implements the SDK-wide [mixed state contract](/components/mixed-state). It is presentation state, not a sentinel form value: while mixed, the select shows `mixedLabel`, keeps the raw form value unchanged, hides selected chips, and does not mark any option as selected.

```html
<et-select
  [(mixed)]="categoryIsMixed"
  [formField]="form.category"
  mixedLabel="Different values"
  placeholder="Pick a category"
>
  @for (category of categories; track category.id) {
  <et-select-option [value]="category.id">{{ category.name }}</et-select-option>
  }
</et-select>
```

Treat `mixed` as explicitly controlled state. Updating the raw form value from application code does not change it; set `categoryIsMixed` to `false` yourself when external data establishes one value. Setting it to `false` reveals whatever raw value is currently in the form.

- Committing an option or custom value replaces the hidden raw value and resolves mixed. In multi mode, that first commit starts a new array containing the committed option; later commits use normal toggle behavior.
- Clear writes `null` for single select or `[]` for multi-select and resolves mixed. Opening, searching, or cancelling leaves it unchanged; closing only resolves mixed when `commitCustomValueOnClose` successfully commits pending text.
- Keyboard deletion never mass-clears: Backspace on an empty multi-select search input is a no-op while mixed (there is no visible chip to delete — the clear button is the destructive path). Erasing the displayed label text in a searchable _single_ select clears, exactly as it does for a committed value.
- Headless note: while mixed, every option reports unselected — including unbound options whose `checked` input the consumer set explicitly. Mixed is the stronger claim.
- `allowAddNew` only emits `addNew`; it neither writes a value nor resolves mixed. After creating the option, update the form value and set `mixed` to `false` explicitly.
- Signal Forms validation continues to inspect the raw form value. The mixed presentation by itself does not satisfy `required` or otherwise override validation.
- Listbox options use `aria-selected="false"` while mixed. They never expose `aria-selected="mixed"`, which is not a valid option state. The select host exposes `data-mixed` for consumer styling.

### Custom trigger value

Replace the default label/chips display entirely by projecting an `ng-template[etSelectValue]` — it renders inside the trigger with the selected items as context. While `mixed` is true, `mixedLabel` takes precedence and the custom value template is not rendered:

```html
<et-select [formField]="demoForm.fruits" multiple>
  <ng-template etSelectValue let-items>{{ items.length }} fruits picked</ng-template>

  @for (fruit of fruits; track fruit.value) {
  <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
  }
</et-select>
```

In a **searchable single** select the rich template is the _resting_ display only: while the field is focused (edit mode) it gives way to the selected option's plain-text label inside the search input, so keyboard editing behaves like any searchable single select — the label is selected on open (type to replace it), Backspace edits the visible text, and erasing it clears the selection. The rich template returns once the field is blurred. (This is what stops a lone Backspace on a rich, input-empty field from silently wiping the value.)

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
  args: (query, page) => (query() ? { queryParams: { q: query(), page: page() } } : null),
  toOptions: (res) => res.items,
  toHasMore: (res) => res.page < res.totalPages,
});
```

Bind the returned bundle with the `[etSelectOptions]` directive and it wires everything for you — `loading`, `error`, `hasMoreItems`, `filterMode="external"`, and the `setQuery`/`loadMore` plumbing — so you only render the options:

```html
<et-select [formField]="form.assignee" [etSelectOptions]="users">
  <input etSelectSearch placeholder="Search users" />
  @for (user of users.options(); track user.id) {
  <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
  }
</et-select>
```

`[etSelectOptions]` accepts the bundle from either factory (both return the same shape), so the v2 adapter binds identically. Prefer it over wiring the inputs by hand; the explicit form below is equivalent and still supported when you need to intercept an individual binding:

```html
<et-select
  [formField]="form.assignee"
  [loading]="users.loading()"
  [error]="users.error()"
  [hasMoreItems]="users.hasMore()"
  (queryChange)="users.setQuery($event)"
  (loadMore)="users.loadMore()"
  filterMode="external"
>
  <input etSelectSearch placeholder="Search users" />
  @for (user of users.options(); track user.id) {
  <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
  }
</et-select>
```

The factory debounces the query (`debounceTime`, default 300ms), skips requests below `minQueryLength`, and maps failures to the error row's text (`toErrorMessage`). **Pagination is built in:** `args` receives a `page` signal (starting at `initialPage`, default `1`) that resets on every query change and advances when you call `loadMore()`. Return only the current page's slice from `toOptions` — the factory appends each page to the accumulated `options`. Derive `hasMore` via `toHasMore` and wire `loadMore` to `(loadMore)`; it's a no-op while loading, when skipped, or once `hasMore` is false. To preload options so the panel isn't empty on first open, let `args` return request args for the empty query (return `null` instead to require a query first).

Apps still on the [legacy `V2QueryClient`](/query/legacy) use `selectOptionsFromV2Query` instead — same config shape and returned signal bundle, but `queryCreator` takes a legacy creator (from `client.get(...)` or a `createLegacyQueryCreator` interop wrapper) and `args` builds the `prepare()` arguments. Options stay rendered while the next request loads, matching the current-system adapter.

### Custom values

<StoryEmbed id="components-forms-select--custom-values" height="420px" />

With `allowCustomValues`, the query becomes committable as a value of its own. Whenever the (normalized) query is neither an existing selection nor an exact label match of a visible option, the panel ends in a **"Create …" row** — a real listbox option, so it takes part in virtual focus: it holds <kbd>Enter</kbd> when nothing else matches, and stays one <kbd>ArrowDown</kbd> away while options still match (you can create `java` even while `javascript` is listed). In multi mode a committed custom value becomes a chip and the search clears; in single mode it becomes the value and the panel closes. The row's leading text is configurable via `createLabel`; headless compositions render their own row bound to `customValueCandidate()` and mark it with `customValueOption` (or call the public `commitCustomValue(raw)` imperatively).

The tag-input ergonomics are available on top:

- **`customValueSeparators`** — single characters (e.g. `[',']`) that commit the pending text the moment they are typed, and split pasted text on separators/newlines into several values (multi mode).
- **`commitCustomValueOnClose`** — pending text commits instead of being discarded when the panel closes via <kbd>Tab</kbd> or an outside click (an <kbd>Escape</kbd> close never commits — it clears the query first).
- **`normalizeCustomValue`** — maps raw text to the stored value, return `null` to reject; defaults to trimming.
- **`maxSelection`** — caps the number of selected values (multi mode); at the cap the search input locks (like the tag input's `maxTags`) and every still-unselected option renders disabled (skipped by keyboard navigation, like any disabled option) until a value is removed. Selected options stay enabled for deselection.

Prefer this over [`et-tag-input`](/components/text-inputs#tag-input) whenever suggestions/autocomplete are involved — it is a superset of the tag input's behavior with an option list on top. The tag input remains the deliberately minimal variant for pure free-text entry with no panel at all.

### Adding new options

With `allowAddNew`, the panel ends in a distinct "Add new" action row (label via `addNewLabel`). Picking it emits `(addNew)` with the current search query and closes the panel — open a creation dialog (or create inline), then set the new value yourself:

```html
<et-select [formField]="form.project" (addNew)="openCreateProjectDialog($event)" allowAddNew>
  <input etSelectSearch placeholder="Search projects" />
  @for (project of projects(); track project.id) {
  <et-select-option [value]="project.id">{{ project.name }}</et-select-option>
  }
</et-select>
```

Unlike `allowCustomValues` (which commits the raw query string directly), the add-new flow leaves creating the value entirely to you — use it when new entries need real backing data. See the `AddNewOption` story for a working example.

### Command picker

Set `pickOnly` to use a single select as a fire-and-forget "add" picker (search → pick → append to an external list): committing an option emits `(pickOption)` with the picked value **without ever writing `value`**, so the select stays empty and immediately ready for the next pick. Use it when the select feeds a list you own rather than holding a value of its own — it removes the set-then-clear dance (and its race with the `[(value)]` write-back) that a `valueChange`-based picker needs.

```html
<et-select [pickOnly]="true" (pickOption)="addMember($event)" placeholder="Add a member">
  <input etSelectSearch placeholder="Search people" />
  @for (person of people(); track person.id) {
  <et-select-option [value]="person.id">{{ person.name }}</et-select-option>
  }
</et-select>
```

`pickOption` also fires in normal (non-`pickOnly`) single selects — there it accompanies the value selection, as a "the user actively picked this" signal distinct from `valueChange` (which also fires on programmatic writes and clears). `pickOnly` has no effect in multi-select.

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

## Large option lists (virtualization)

For big client-side lists, pass the options as data instead of projecting `et-select-option`s — the select renders the rows itself and **virtualizes** them: only the rows near the panel's viewport exist in the DOM (2000 options ≈ 15 rendered nodes), with block paddings standing in for the rest of the scroll height. Keyboard navigation, typeahead, internal filtering and label resolution still work across the **full** data set, because every entry registers as an option — only the rendering is windowed.

```html
<et-select [formField]="form.item" [options]="items" placeholder="Pick an item">
  <input etSelectSearch placeholder="Search 2000 items" />
</et-select>
```

```ts
items: SelectOptionData[] = hugeList.map((entry) => ({ value: entry.id, label: entry.name }));
```

Each entry is `{ value, label, disabled? }` (`SelectOptionData`); values must be unique. Extra fields on an entry are kept and handed to the row template. Rows render as the plain `label` by default — project an `ng-template[etSelectOptionTemplate]` to customize them, with the source entry as context (see the `OptionTemplate` story):

```html
<et-select [formField]="form.assignee" [options]="users">
  <ng-template etSelectOptionTemplate let-user>
    <span class="user-row">{{ user.label }} — {{ user.email }}</span>
  </ng-template>
</et-select>
```

Notes:

- Rows are assumed to share one uniform height (the first rendered row is measured). Wildly varying row heights are not supported.
- Data-driven options can be combined with projected `et-select-option`s (e.g. a pinned entry), which render normally after the windowed rows and are not virtualized. Option groups are presentational wrappers around _projected_ options and don't apply to the flat `options` data.
- For unbounded/server-side datasets, the [async options](#async-options) pattern (`filterMode="external"` + `hasMoreItems`/`loadMore`) remains the right tool — `options` composes with it, since you control the array you bind.
- Headless: mark your scroll container with `[etSelectViewport]`, render `select.virtualizedItems()` with `[etSelectVirtualOption]="item"` rows, and apply `select.virtualWindow.paddingTop()/paddingBottom()` as block paddings around them. Without a registered viewport, every visible option renders (no windowing). `SelectItem.element()` is `null` while a data-driven option is outside the rendered window.

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
