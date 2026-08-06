# Tree

`et-tree` renders a hierarchy as an indented, keyboard-navigable [ARIA tree](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): one tab stop, arrow keys to move and expand, and children loaded per branch the first time they open. Reach for it when the shape of the data is what the user is navigating - a file browser, a category picker, an org chart. When the user is picking one value out of a hierarchy inside a form, use the [cascader](/components/cascader) instead: it commits a value and closes, where a tree stays open and browsable. Import `TREE_IMPORTS`.

```ts
import { TREE_IMPORTS, TreeDataSource } from '@ethlete/components';
```

```ts
const files: TreeDataSource<string> = {
  loadChildren: (parent) =>
    this.http.get<TreeNode<string>[]>('/api/files', { params: { parent: parent?.value ?? '' } }),
};
```

```html
<et-tree [(value)]="selectedPath" [dataSource]="files" aria-label="Project files" />
```

## Live demo

<StoryEmbed id="components-tree--default" height="520px" />

## The data source

A tree never holds the hierarchy itself. It asks a `TreeDataSource` for one level at a time:

```ts
type TreeDataSource<T> = {
  loadChildren(parent: TreeNode<T> | null): TreeNode<T>[] | Promise<TreeNode<T>[]> | Observable<TreeNode<T>[]>;
};
```

`parent` is `null` for the root level. Returning a plain array covers a static tree; a `Promise` or `Observable` covers a remote one, and a branch is only ever asked for once it is expanded - so a hierarchy that is deep, wide or paid-for by the request costs only what the user actually opens. A level is loaded **once** and then kept: collapsing and re-expanding a branch is instant, and `retry(node)` is what reloads it.

This is the same shape as the cascader's `CascaderDataSource.loadChildren`, so one source object can drive an `et-tree` and an `et-cascader` over the same hierarchy.

Each node is a `TreeNode<T>`:

| Field         | Type      | Description                                                                                            |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `value`       | `T`       | Identifies the node. Expansion, selection and focus are tracked by it, so it must be unique tree-wide. |
| `label`       | `string`  | The visible text, and what type-ahead matches on.                                                      |
| `isLeaf`      | `boolean` | Marks the node terminal - it never expands and shows no chevron.                                       |
| `hasChildren` | `boolean` | `false` is the same as `isLeaf`. Omit it to discover children lazily by loading them.                  |
| `disabled`    | `boolean` | The node cannot be expanded or selected.                                                               |

A branch whose `hasChildren` is unknown gets a chevron and, if its load returns nothing, simply expands to nothing. Set `isLeaf: true` (or `hasChildren: false`) whenever the source already knows, and the chevron is right the first time.

::: warning `value` must be unique across the whole tree, not just among siblings
Two nodes sharing a value expand, select and focus as one. For a file tree that means the full path, not the file name.
:::

## Options

| Input            | Type                               | Default             | Description                                                                       |
| ---------------- | ---------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `dataSource`     | `TreeDataSource<T> \| null`        | `null`              | The hierarchy to render. Required - a tree without one throws in dev mode.        |
| `selectionMode`  | `'none' \| 'single' \| 'multiple'` | `'single'`          | Whether rows select, and how many at a time.                                      |
| `value`          | `T \| T[] \| null`                 | `null`              | Two-way bindable selection. `T \| null` in single mode, `T[]` in multiple.        |
| `expandedValues` | `readonly T[]`                     | `[]`                | Two-way bindable set of expanded branch values - the tree's only expansion state. |
| `compareWith`    | `(a: T, b: T) => boolean`          | `(a, b) => a === b` | Value equality. Override when node values are objects.                            |
| `disabled`       | `boolean`                          | `false`             | Nothing expands or selects; rows stay readable and reachable.                     |
| `toErrorMessage` | `(error: unknown) => string`       | `Error.message`     | Turns a failed load into the text shown on the branch.                            |
| `loadingLabel`   | `string`                           | `'Loading…'`        | Shown while the root level loads.                                                 |
| `emptyLabel`     | `string`                           | `'Nothing to show'` | Shown when the root loaded no nodes.                                              |
| `retryLabel`     | `string`                           | `'select to retry'` | Appended to a failed level's message.                                             |

`nodeActivate` fires with the `TreeNode<T>` whenever a row is clicked or <kbd>Enter</kbd>ed - branches included, and regardless of `selectionMode`. It is how a `selectionMode="none"` tree navigates somewhere instead of holding a value.

### Expansion is state you own

Nothing is inferred from the data: `expandedValues` is the whole expansion state, so it can be persisted and restored as-is.

```html
<et-tree [(expandedValues)]="openBranches" [dataSource]="files" />
```

Bind it to open a branch programmatically, or to restore a set from storage - a value whose branch has not loaded yet is kept rather than pruned, so it opens as soon as that node arrives. `expand()`, `collapse()`, `toggleExpansion()`, `expandAll()` and `collapseAll()` on the directive write the same signal. On a lazy source `expandAll()` reaches one level past what is currently loaded; call it again once the new branches arrive to keep going.

### Selection

| Mode         | Behavior                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `'single'`   | Activating a row selects it. `value` is `T \| null`.                                            |
| `'multiple'` | Activating a row toggles it. `value` is `T[]`, and the host gets `aria-multiselectable="true"`. |
| `'none'`     | Rows never select and emit no `aria-selected`. Expansion, focus and `nodeActivate` still work.  |

Selections are independent per node - a branch is not implied by its children, and checking every child does not fill in the parent. A tree with tri-state checkbox semantics is the [cascader](/components/cascader) in `multiple` mode, which tracks that explicitly.

Activating a branch selects **and** expands it (a folder click is both), so `selectionMode="none"` is the way to get expansion-only rows.

The two modes look different on purpose. `single` fills the one selected row with the accent and tints its label to match. `multiple` never fills a selected row at all - a run of adjacent selections would merge into one accent block - so it states the selection through a leading check box instead, the way [select](/components/select) and [cascader](/components/cascader) do, and keeps the fill for hover and press. The box renders on every row whether or not it is selected, so ticking one never shifts its label.

<StoryEmbed id="components-tree--multi-select" height="520px" />

## Lazy loading, and what happens when it fails

While a branch loads, its chevron becomes a spinner and the row is `aria-busy`. The root level shows `loadingLabel` instead of rows.

If a load fails, the branch keeps its place and shows the message from `toErrorMessage` alongside `retryLabel`. **Activating that row again reloads it** rather than collapsing it, which is why there is no separate retry button to reach for - the row is the control, and it works with the pointer and with <kbd>Enter</kbd> alike. A failed root load becomes a single row that behaves the same way. `retry(node)` (or `retry(null)` for the root) does it programmatically, and doubles as "refresh this branch" for a level that loaded fine.

<StoryEmbed id="components-tree--lazy-loading" height="520px" />

## Custom rows

By default a row shows `node.label`. Project an `<ng-template etTreeNodeDef>` to render it with markup instead - the node is the implicit value, and the full row is available as `let-row` for the level, expansion and load state:

```html
<et-tree [dataSource]="files">
  <ng-template etTreeNodeDef let-node let-row="row">
    <i [etIcon]="row.isExpandable ? 'folder' : 'file'"></i>
    {{ node.label }} @if (row.isExpandable) {
    <span class="count">{{ node.value | childCount }}</span>
    }
  </ng-template>
</et-tree>
```

The template is rendered with the DI of the place it was written, so an `etIcon` in it resolves against your own `provideIcons()` - not the tree's.

<StoryEmbed id="components-tree--custom-rows" height="520px" />

## Headless

`[etTree]` is the behavior on its own: the expansion state, the selection, roving focus, the keyboard model and the loading, with no chrome. It flattens the hierarchy into `visibleRows()` - one entry per visible row, carrying everything a row needs to render - which you render with a single `@for` and `[etTreeNode]`:

```html
<div #tree="etTree" [dataSource]="files" etTree aria-label="Project files">
  @for (row of tree.visibleRows(); track row.node) {
  <div [row]="row" [style.padding-left.px]="row.level * 16" etTreeNode>{{ row.node.label }}</div>
  }
</div>
```

Rows are flat rather than nested on purpose: one `@for` over a computed list, no recursive component, and re-parenting a node moves a row instead of destroying a subtree. Each `TreeRow<T>` carries `node`, `level` (1-based), `path` (root → node), `isExpandable`, `isExpanded`, `isDisabled`, `childrenStatus`, `childrenError`, `posInSet` and `setSize`.

`[etTreeNode]` supplies the row's ARIA, its share of the roving tab stop and its interaction. `et-tree-marker` is the default component's chevron/spinner/warning slot, should you want the same marker in your own template.

## Accessibility

The host is `role="tree"` (plus `aria-multiselectable` in multiple mode, and `aria-busy` while the root loads). **Give it an accessible name** - `aria-label`, or `aria-labelledby` pointing at a visible heading.

Rows are `role="treeitem"` with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` (branches only), `aria-selected` (unless `selectionMode="none"`) and `aria-disabled`. Because the DOM is flat rather than nested in `role="group"` elements, those position attributes are what tell assistive tech the shape of the tree - which is why `visibleRows()` computes them and `[etTreeNode]` binds them for you.

| Key                              | Action                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| <kbd>Tab</kbd>                   | Enters the tree on its single tab stop, or leaves it                    |
| <kbd>↑</kbd> / <kbd>↓</kbd>      | Previous / next visible row, across levels                              |
| <kbd>→</kbd>                     | Expands a collapsed branch, or moves into an expanded one               |
| <kbd>←</kbd>                     | Collapses an expanded branch, or moves to the parent                    |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last visible row                                                |
| <kbd>Enter</kbd>                 | Activates the row - selects, expands, or retries a failed branch        |
| <kbd>Space</kbd>                 | Selects the row without expanding it                                    |
| <kbd>\*</kbd>                    | Expands every sibling of the focused row                                |
| any character                    | Type-ahead: focuses the next row whose label starts with what was typed |

<kbd>→</kbd> and <kbd>←</kbd> expand and collapse, so they follow the writing direction and swap under `direction: rtl` (as does the chevron). The tab stop stays on the row the user last focused, so <kbd>Shift</kbd>+<kbd>Tab</kbd> back into the tree re-enters where they left off; arrow navigation does not wrap, since running off the end of a tree is disorienting rather than helpful.

## Theming

Public design tokens: `--et-tree-indent` (default `18px`), `--et-tree-node-padding-block` (`5px`), `--et-tree-node-padding-inline` (`6px`), `--et-tree-node-gap` (`6px`), `--et-tree-node-radius` (`6px`), `--et-tree-marker-size` (`12px`), `--et-tree-check-size` (`16px`, `multiple` mode only), `--et-tree-duration` (`150ms`).

Indentation is padding on the flat row rather than nested boxes, which is what keeps the hover and selection tints spanning the full width at every depth - so `--et-tree-indent` is the one token to reach for when rows feel cramped or too far out.

Colors resolve from the app-registered surface and color themes: rows take their text from `--et-surface-color-solid`, their hover and active tints from `--et-surface-interaction-solid`, and the selected state from `--et-theme-color-primary-solid` and `--et-theme-color-ink-solid` (in `multiple` mode only the check box uses the accent, filling with `--et-theme-color-primary-solid` and drawing its mark in `--et-theme-color-on-primary` - the row keeps its surface fill and `--et-surface-color-solid` label). In `single` mode a selected row that is hovered deepens its accent instead of falling back to the neutral tint; in `multiple` mode the neutral tint is the only fill there is. A disabled row - whether from the tree-wide `disabled` input or a node's own flag - drops to `opacity: 0.4` and takes no hover or press tint at all, in either selection mode. Failed-branch text uses `--et-tree-error-color`, which falls back to muted body text - point it at your error theme's ink color if you want a red one, since the tree deliberately does not require an app to register a `type: 'error'` theme just to render. See [theming](/core/theming).

## Error codes

The tree throws `ET46xx` in dev mode - a missing `[dataSource]`, or a tree part used outside an `[etTree]`. See [error codes](/components/error-codes#tree-et46xx).
