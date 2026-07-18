# Cascader

`et-cascader` selects a value from a **hierarchy** by browsing it level by level — competition → stage → tournament → match, org → team → player, any nested taxonomy. It is deliberately generic: an abstract data source feeds it, each level loads on demand, and it commits the chosen leaf (or, optionally, any node) as the form value. It is the [select](/components/select)'s sibling — a value control with an anchored overlay — for data that is **browsed, not searched**. Import `CASCADER_IMPORTS`.

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

## Options

On `et-cascader` (forwarded from the headless `[etCascader]` directive):

| Input              | Type                            | Default  | Description                                                                                   |
| ------------------ | ------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `dataSource`       | `CascaderDataSource<T> \| null` | `null`   | The hierarchy to browse (required to open).                                                   |
| `selectableLevels` | `'leaf' \| 'any'`               | `'leaf'` | `'leaf'` commits only terminal nodes; `'any'` also commits intermediate branches (see below). |
| `compareWith`      | `(a: T, b: T) => boolean`       | `===`    | Value equality — override when values are objects.                                            |
| `toErrorMessage`   | `(error: unknown) => string`    | generic  | Maps a `loadChildren` failure to the column's error text.                                     |
| `mirrorPanelWidth` | `boolean`                       | `false`  | Whether the panel matches the field width (off — columns size themselves).                    |
| `placeholder`      | `string`                        | `''`     | Shown on the trigger until a value is committed.                                              |

The `value` model is the selected node's `value` (`T | null`). The full chosen chain is exposed as `path` (`CascaderNode<T>[]`) and `pathValue` (`T[]`) computeds, and the trigger shows the breadcrumb (`Euro / Knockout stage / Final`).

## Selectable levels

By default only leaves commit — clicking a branch just drills into it. With `selectableLevels="any"`, clicking a branch **both** drills in and commits that node, so an intermediate level (a whole stage, say) can be the value:

<StoryEmbed id="components-forms-cascader--any-level" height="380px" />

## Async levels

Point `dataSource.loadChildren` at a `Promise` or `Observable` and each column loads on demand — nothing is fetched up front:

<StoryEmbed id="components-forms-cascader--async-levels" height="380px" />

## Desktop vs. mobile

On wider viewports the levels render as **Miller columns** side by side. On small viewports the panel becomes a **bottom sheet that drills one column at a time**, with a back control to ascend — the overlay's breakpoint swap handles this automatically, so the same markup works on both.

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

## Accessibility

- The trigger is a `role="combobox"` with `aria-haspopup="tree"`, `aria-expanded`, and `aria-controls` pointing at the open tree panel; the panel is a `role="tree"` of `role="group"` columns and `role="treeitem"` nodes carrying `aria-level`, `aria-selected`, and `aria-expanded` on branches.
- The panel takes focus on open. Roving tabindex keeps exactly one node tabbable.

| Key             | Action                                    |
| --------------- | ----------------------------------------- |
| Arrow Up / Down | Move focus within the current column      |
| Arrow Right     | Drill into the focused branch             |
| Arrow Left      | Return to the parent column               |
| Home / End      | First / last node of the column           |
| Type a name     | Jump to the first matching node in column |
| Enter / Space   | Select the focused node (commit or drill) |

## Theming

Panel chrome uses the [surface theme](/core/theming); the selected chain and branch chevrons use the color theme's ink (`--et-theme-color-ink-solid`), and the error state resolves the app's `type: 'error'` theme. Public design tokens:

| Token                                | Default | Purpose                         |
| ------------------------------------ | ------- | ------------------------------- |
| `--et-cascader-column-inline-size`   | `220px` | Width of one Miller column      |
| `--et-cascader-panel-max-block-size` | `320px` | Max height of the panel/columns |
| `--et-cascader-node-height`          | `36px`  | Min height of a node row        |

## Scope

v1 is single-select, leaf-or-any-level. A flat **search augment** (jump straight to a known leaf) and a `cascaderFromQuery` convenience for [`@ethlete/query`](/query/)-backed levels are planned follow-ups; the data-source contract already accepts an `Observable`, so query-backed levels work today by wiring one yourself. Multi-select with indeterminate parents is a separate future slice.

## Error codes

The cascader domain owns the `ET3300`–`ET3399` range — see [error codes](/components/error-codes#cascader-et33xx).
