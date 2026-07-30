# Cascader

`et-cascader` selects a value from a **hierarchy** by browsing it level by level — competition → stage → tournament → match, org → team → player, any nested taxonomy. It is deliberately generic: an abstract data source feeds it, each level loads on demand, and it commits the chosen leaf (or, optionally, any node) as the form value. It is the [select](/components/select)'s sibling — a value control with an anchored overlay — for data that is **browsed rather than searched** (though a [flat search](#flat-search) augment can jump straight to a known node). Import `CASCADER_IMPORTS`.

```ts
import { CASCADER_IMPORTS } from '@ethlete/components';
```

```html
<et-form-field>
  <et-label>Match</et-label>
  <et-cascader [formField]="form.match" [dataSource]="competitions" placeholder="Browse competitions" />
</et-form-field>
```

## Live demo

<StoryEmbed id="components-forms-cascader--default" height="380px" />

## Data source

The cascader never holds the whole tree — it asks a `CascaderDataSource<T>` for one level at a time:

```ts
protected competitions: CascaderDataSource<string> = {
  loadChildren: (parent) => this.api.children(parent?.value ?? null), // array | Promise | Observable
};
```

`loadChildren(parent)` returns the children of a node — or the root's children when `parent` is `null` — as a **sync array, a `Promise`, or an `Observable`**. Static trees and per-level async both work, and a level only loads when the user drills into it. Each returned `CascaderNode<T>` is:

| Field         | Type      | Meaning                                                                        |
| ------------- | --------- | ------------------------------------------------------------------------------ |
| `value`       | `T`       | Committed to the form when the node is selected.                               |
| `label`       | `string`  | The visible text.                                                              |
| `isLeaf`      | `boolean` | Marks a terminal, selectable node that never expands.                          |
| `hasChildren` | `boolean` | `false` makes the node terminal; omit it to discover children by loading them. |
| `disabled`    | `boolean` | Blocks selecting and expanding.                                                |

A column shows a loading state while its level resolves, an empty state when a branch has no children, and an error row with a **Retry** control when `loadChildren` rejects or errors (`toErrorMessage` maps the failure to text).

### Resolving a programmatic value — `resolvePath`

The cascader can't reverse a lazy tree on its own, so when the value is set **programmatically** (a form patch/restore) rather than picked in the panel, the trigger shows the placeholder until you re-open and re-pick — unless the data source implements the optional `resolvePath(value)`:

```ts
protected competitions: CascaderDataSource<string> = {
  loadChildren: (parent) => this.api.children(parent?.value ?? null),
  // return the root→node chain for a value (array | null | Promise | Observable)
  resolvePath: (value) => this.api.pathTo(value),
};
```

It returns the ancestor chain (root → committed node) so the trigger can render the breadcrumb. Return `null` (or an empty array) when the value has no resolvable path. For a static tree it's a trivial depth-first search; for an async source, resolve it however your backend allows.

## Flat search

Browsing is the cascader's default mode, but a user who already knows the leaf they want shouldn't have to drill for it. Implement the optional `search(query)` hook on the data source and the panel gains a search input — typing swaps the columns for a **flat result list across all levels**, each result showing its full breadcrumb:

<StoryEmbed id="components-forms-cascader--search" height="420px" />

```ts
protected competitions: CascaderDataSource<string> = {
  loadChildren: (parent) => this.api.children(parent?.value ?? null),
  // return the matching paths — root → matching node chains (array | Promise | Observable)
  search: (query) => this.api.searchMatches(query),
};
```

Like `resolvePath`, the hook lives on the data source because the tree is lazy — only the source can search branches that were never loaded. For a static tree it's a depth-first walk collecting matches; for an async source, a backend search endpoint. A failed search shows an error row with a **Retry** control (`toErrorMessage` maps the failure).

Activating a result **commits the match and closes** — the trigger shows its full breadcrumb. If a match is a branch that can't be committed (leaf mode), activating it instead **jumps the columns to that branch** and clears the query, so browsing continues from there.

The input takes focus when the panel opens, and typing anywhere in the tree routes into it (replacing the per-column typeahead). <kbd>ArrowDown</kbd> moves from the input into the results (or the tree while browsing), typing from a result returns to the input, and the first <kbd>Escape</kbd> clears the query — only a second one closes the panel. The default component labels the input via `searchPlaceholder` (unset → [`CASCADER_LABELS.search`](/components/localization), `Search`).

## Query-backed levels — `cascaderFromQuery`

For levels served by an [`@ethlete/query`](/query/) API, `cascaderFromQuery` builds the whole data source in one call — like [`selectOptionsFromQuery`](/components/select#async-options), but per level. Each level load runs its own query (levels load concurrently, e.g. when the panel re-opens onto a committed branch), with the client's dedup and caching coalescing repeats:

```ts
competitions = cascaderFromQuery({
  queryCreator: getCompetitionChildren,
  args: (parent) => ({ queryParams: { parent: parent?.value ?? null } }),
  toNodes: (res) => res.items.map((item) => ({ value: item.id, label: item.name, isLeaf: item.isMatch })),
  search: {
    queryCreator: searchCompetitions,
    args: (query) => ({ queryParams: { q: query } }),
    toResults: (res) => res.matches.map((match) => match.path.map((p) => ({ value: p.id, label: p.name }))),
  },
});
```

Call it from a field initializer / constructor (injection context) — the same place you'd create a query — and bind the result to `[dataSource]`. `args` builds the request for a `parent` (the root when `null`; return `null` to skip and show the level as empty), `toNodes` maps the response to the level's nodes. The optional `search` block wires the [flat search](#flat-search) the same way (`toResults` maps to root → match path chains) and debounces requests (`debounceTime`, default 300ms; `minQueryLength`, default 1). A failed request surfaces as the column's (or the result list's) error row with **Retry** — the text comes from `toErrorMessage` (default: the response's first error message). A `resolvePath` implementation passes straight through to the data source.

## Multi-select

With `multiple`, activating a node **toggles** its value instead of committing-and-closing — the form value is a `T[]`. Leaves toggle on click; branches still just drill (in `selectableLevels="any"` they toggle **and** drill). Every row gains a check square: selected nodes show a checkmark, an ancestor of a **partial** selection shows the **indeterminate dash**, and an ancestor whose descendants are **all** selected promotes to the full checkmark — so selection progress is visible from the root column. The promotion is display-only (the form value stays the exact selected nodes) and covers subtrees the cascader has loaded; a lazy branch that was never drilled into can only show the dash, since its full child list is unknown. Disabled children don't block the promotion. The trigger joins the selected labels (`Group A, Group B`), and the clear (×) control empties the whole selection:

<StoryEmbed id="components-forms-cascader--multiple" height="380px" />

With a [flat search](#flat-search), activating a result toggles it and **keeps the result list and query alive**, so several hits of one search can be picked in a row:

<StoryEmbed id="components-forms-cascader--multiple-with-search" height="420px" />

Values set programmatically (a form patch/restore) display and mark their ancestors once the data source's [`resolvePath`](#resolving-a-programmatic-value-—-resolvepath) resolves their chains — one call per unknown value. The panel reports itself as an `aria-multiselectable` tree.

## Mixed values in bulk editors

Try it live in Storybook: `Components/Forms/Cascader` → `Mixed` / `Mixed multiple`.

Use `mixed` when one cascader edits several records whose current values differ. It is presentation state, not a sentinel form value: while mixed, the trigger shows `mixedLabel` instead of the breadcrumb (or the joined labels in [multi mode](#multi-select)), the raw form value stays unchanged, and no node reports itself as selected — checkmarks, partial-branch indeterminate dashes, and `aria-selected` all read as unselected, and the panel opens at the root instead of re-opening the hidden branch.

```html
<et-cascader
  [(mixed)]="categoryIsMixed"
  [formField]="form.category"
  [dataSource]="categories"
  mixedLabel="Different values"
  placeholder="Browse categories"
/>
```

Treat `mixed` as explicitly controlled state. Updating the raw form value from application code does not change it; set `categoryIsMixed` to `false` yourself when external data establishes one value. Setting it to `false` reveals whatever raw value is currently in the form.

- The first user commit **replaces** the hidden raw value and resolves mixed: a single-mode pick sets that node's value; the first multi-mode toggle starts a fresh array containing only the toggled node — even when that node was part of the hidden selection — and later toggles behave normally again. Committing a [flat search](#flat-search) result works the same way.
- The clear (×) control writes the empty shape (`null` single, `[]` multi) and resolves mixed.
- Opening, browsing, searching, and cancelling a search leave mixed unchanged — deleting the search query never touches the hidden value; the clear control is the only destructive path.
- Signal Forms validation continues to inspect the raw form value. The mixed presentation by itself does not satisfy `required` or otherwise override validation.
- Tree nodes (and search results) use `aria-selected="false"` while mixed — they never expose `aria-selected="mixed"`, which is not a valid tree-item state. The cascader host exposes `data-mixed` for consumer styling.

## Options

On `et-cascader` (forwarded from the headless `[etCascader]` directive):

| Input               | Type                            | Default  | Description                                                                                                                                                                            |
| ------------------- | ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataSource`        | `CascaderDataSource<T> \| null` | `null`   | The hierarchy to browse (required to open).                                                                                                                                            |
| `multiple`          | `boolean`                       | `false`  | [Multi-select](#multi-select): activations toggle values, the form value is a `T[]`.                                                                                                   |
| `selectableLevels`  | `'leaf' \| 'any'`               | `'leaf'` | `'leaf'` commits only terminal nodes; `'any'` also commits intermediate branches (see below).                                                                                          |
| `compareWith`       | `(a: T, b: T) => boolean`       | `===`    | Value equality — override when values are objects.                                                                                                                                     |
| `toErrorMessage`    | `(error: unknown) => string`    | see note | Maps a `loadChildren` / `search` failure to the panel's error text. Default: an `Error`'s `message` verbatim, a generic fallback otherwise.                                            |
| `mirrorPanelWidth`  | `boolean`                       | `false`  | Whether the panel matches the field width (off — columns size themselves).                                                                                                             |
| `maxVisibleColumns` | `number`                        | `3`      | Columns shown side by side before older levels collapse into the [breadcrumb row](#deep-hierarchies) (min 1).                                                                          |
| `mixed`             | `boolean`                       | `false`  | Presents an [unresolved bulk-edit selection](#mixed-values-in-bulk-editors) independently of `value`. Two-way bindable (`mixedChange`); a user commit or clear resolves it to `false`. |
| `mixedLabel`        | `string \| null`                | `null` ¹ | Trigger text shown while `mixed` is true.                                                                                                                                              |
| `placeholder`       | `string`                        | `''`     | Shown on the trigger until a value is committed.                                                                                                                                       |
| `searchPlaceholder` | `string \| null`                | `null` ¹ | Placeholder of the panel's [flat search](#flat-search) input (rendered only when the data source has a `search` hook).                                                                 |

¹ `null` falls through to the domain's label set — [`FORM_FIELD_LABELS.mixed`](/components/localization) for `mixedLabel`, [`CASCADER_LABELS`](/components/localization) for `searchPlaceholder`, `backLabel` and the panel's loading/empty/retry states.

The `value` model is the selected node's `value` (`T | null`; a `T[]` with [`multiple`](#multi-select)). The full chosen chain is exposed as `path` (`CascaderNode<T>[]`) and `pathValue` (`T[]`) computeds, and the trigger shows the breadcrumb (`Euro / Knockout stage / Final`) — or the joined labels in multi mode.

## Selectable levels

By default only leaves commit — clicking a branch just drills into it. With `selectableLevels="any"`, clicking a branch **both** drills in and commits that node, so an intermediate level (a whole stage, say) can be the value:

<StoryEmbed id="components-forms-cascader--any-level" height="380px" />

## Async levels

Point `dataSource.loadChildren` at a `Promise` or `Observable` and each column loads on demand — nothing is fetched up front:

<StoryEmbed id="components-forms-cascader--async-levels" height="380px" />

## Deep hierarchies

The desktop panel shows at most **`maxVisibleColumns`** (default `3`) columns side by side — without a cap, a six-level drill would grow the panel a column-width per level until it hits the viewport edge. Once the drill overflows the window, the **whole drilled trail** appears as a breadcrumb row below the columns (below, so appearing crumbs never shift the columns; the panel's animated height covers the row mounting). Crumbs whose levels are currently in view render at full strength; the muted ones are a click away:

<StoryEmbed id="components-forms-cascader--deep-nesting" height="420px" />

All drilled levels stay mounted on a sliding track, so a level collapsing into a crumb visibly slides out to the left together with the columns following it — and the reverse plays when navigating back. The collapse is purely visual; navigating back never discards the drill:

- **Clicking a crumb** anchors the window at that level and focuses its node; the deeper columns stay drilled, and re-activating the still-expanded branch (or pressing Arrow Right on it) slides forward again without reloading. The crumb row itself mirrors the **drill**, not the window — sliding around never rebuilds it (levels hidden on either side keep their crumbs); it only updates when the drilled path actually changes.
- **Arrow Left** past the window edge slides the window along with the roving focus.
- Activating a **different** node in a revealed column truncates the deeper levels, exactly like it does inside the window.

The bottom-sheet presentation is unaffected — it always drills one column at a time. Headless consumers get the same state as `visibleColumns()` (the windowed slice with absolute indices), `breadcrumbPath()` (the crumbs), `visibleColumnStart()`, and `showColumn(columnIndex)` (the crumb action).

## Desktop vs. mobile

On wider viewports the levels render as **Miller columns** side by side (windowed after [`maxVisibleColumns`](#deep-hierarchies) levels). On small viewports the panel becomes a **bottom sheet that drills one column at a time**, with a back control to ascend — the overlay's breakpoint swap handles this automatically, so the same markup works on both.

## Headless usage

`[etCascader]` owns all state (columns, focus, selection, load orchestration); the sub-directives are thin bindings. Render the columns from `cascader.columns()` and bind each node's `[node]`:

```html
<div [(value)]="value" [dataSource]="source" etCascader>
  <div etCascaderTrigger>{{ cascader.displayValue() ?? 'Pick one' }}</div>
  <ng-template etCascaderSurface>
    @for (column of cascader.columns(); track $index; let i = $index) {
    <div [etCascaderColumn]="i">
      @for (node of column.nodes; track $index) {
      <button [node]="node" etCascaderNode type="button">{{ node.label }}</button>
      }
    </div>
    }
  </ng-template>
</div>
```

For [flat search](#flat-search), place an `input[etCascaderSearch]` in the surface and render `cascader.searchState().results` while `cascader.isSearching()` — each result is a `[etCascaderSearchOption]` with its `[path]` (the root → match chain) and `[index]`:

```html
<input etCascaderSearch placeholder="Search" />
@if (cascader.isSearching()) { @for (result of cascader.searchState().results; track $index) {
<button [path]="result" [index]="$index" etCascaderSearchOption type="button">
  @for (node of result; track $index) { {{ node.label }} }
</button>
} }
```

## Accessibility

- The trigger is a `role="combobox"` with `aria-haspopup="tree"`, `aria-expanded`, and `aria-controls` pointing at the open tree panel; the panel is a `role="tree"` of `role="group"` columns and `role="treeitem"` nodes carrying `aria-level`, `aria-selected`, and `aria-expanded` on branches.
- The panel takes focus on open. Roving tabindex keeps exactly one node tabbable.

| Key             | Action                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| Arrow Up / Down | Move focus within the current column                                                        |
| Arrow Right     | Drill into the focused branch                                                               |
| Arrow Left      | Return to the parent column (sliding a [collapsed level](#deep-hierarchies) back into view) |
| Home / End      | First / last node of the column                                                             |
| Type a name     | Jump to the first matching node in column                                                   |
| Enter / Space   | Select the focused node (commit or drill)                                                   |

With a [flat search](#flat-search) active, the panel reports itself as a `role="listbox"` of `role="option"` results instead, typing routes into the search input (replacing the in-column jump), and Escape clears the query before it closes the panel.

## Theming

Panel chrome uses the [surface theme](/core/theming); the selected chain and branch chevrons use the color theme's ink (`--et-theme-color-ink-solid`), and the error state resolves the app's `type: 'error'` theme. Public design tokens:

| Token                                | Default | Purpose                         |
| ------------------------------------ | ------- | ------------------------------- |
| `--et-cascader-column-inline-size`   | `220px` | Width of one Miller column      |
| `--et-cascader-panel-max-block-size` | `320px` | Max height of the panel/columns |
| `--et-cascader-node-height`          | `36px`  | Min height of a node row        |

## Scope

The cascader selects leaf-or-any-level, in [single or multi mode](#multi-select), with a [flat search](#flat-search) augment and a [`cascaderFromQuery`](#query-backed-levels-—-cascaderfromquery) convenience for query-backed levels.

## Error codes

The cascader domain owns the `ET3300`–`ET3399` range — see [error codes](/components/error-codes#cascader-et33xx).
