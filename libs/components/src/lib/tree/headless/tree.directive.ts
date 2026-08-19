import {
  DestroyRef,
  Directive,
  ElementRef,
  Signal,
  TemplateRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RuntimeError, injectHostElement } from '@ethlete/core';
import { EMPTY, catchError, defer, merge, mergeMap, switchMap, take, tap } from 'rxjs';
import { createTypeahead } from '../../internals/typeahead';
import { TREE_ERROR_CODES } from '../tree-errors';
import { canExpand, defaultCompareWith, nodesEqual, toChildrenObservable } from './internals/tree-data';
import {
  TREE_LEVEL_STATUSES,
  TREE_SELECTION_MODES,
  TreeCompareWith,
  TreeDataSource,
  TreeLevelStatus,
  TreeNode,
  TreeNodeDefContext,
  TreeRow,
  TreeSelectionMode,
} from './tree.types';

type TreeLevel<T> = {
  parent: TreeNode<T> | null;
  status: TreeLevelStatus;
  nodes: TreeNode<T>[];
  error: string | null;
};

type TreeNodeLike<T> = {
  row: Signal<TreeRow<T>>;
  elementRef: ElementRef<HTMLElement>;
};

type TreeNodeDefLike<T> = {
  templateRef: TemplateRef<TreeNodeDefContext<T>>;
};

/**
 * An ARIA tree over a lazily loaded hierarchy: owns the expansion state, the selection, roving focus
 * and the keyboard model, and flattens the whole thing into the list of rows a template renders
 * ({@link visibleRows}). No visual opinion - bring your own template, or use the default `et-tree`.
 *
 * Children are loaded per branch through the {@link TreeDataSource}, the first time that branch is
 * expanded, so a deep or remote hierarchy costs only what the user actually opens. Every node is
 * identified by its `value`, which therefore has to be unique across the tree.
 *
 * Rows are rendered flat rather than nested, which is why each one carries `level`, `posInSet` and
 * `setSize` - a flat DOM has to state those for assistive tech.
 *
 * @example
 * <div [dataSource]="source" [(value)]="selected" etTree #tree="etTree">
 *   @for (row of tree.visibleRows(); track row.node) {
 *     <div [row]="row" etTreeNode>{{ row.node.label }}</div>
 *   }
 * </div>
 */
@Directive({
  selector: '[etTree]',
  exportAs: 'etTree',
  host: {
    role: 'tree',
    '[attr.aria-multiselectable]': 'selectionMode() === "multiple" ? "true" : null',
    '[attr.aria-busy]': 'rootStatus() === "loading" ? "true" : null',
    '[attr.data-disabled]': 'disabled() || null',
  },
})
export class TreeDirective<T = unknown> {
  private hostElement = injectHostElement();

  /** The hierarchical source the tree renders. Required. */
  public dataSource = input<TreeDataSource<T> | null>(null);

  /** Value equality - override when node values are objects. */
  public compareWith = input<TreeCompareWith<T>>(defaultCompareWith);

  /** Whether rows select, and how many at a time. @default 'single' */
  public selectionMode = input<TreeSelectionMode>(TREE_SELECTION_MODES.SINGLE);

  /** The selected value: `T | null` in single mode, `T[]` in multiple. Two-way bindable. */
  public value = model<T | T[] | null>(null);

  /**
   * The values of the expanded branches. Two-way bindable, and the tree's only expansion state - nothing
   * is inferred from the data, so an expansion set can be persisted and restored as-is.
   *
   * Values that match no node are ignored rather than pruned, so a set restored before its branch has
   * loaded still opens once the node arrives.
   */
  public expandedValues = model<readonly T[]>([]);

  /** Refuse to expand, select or move focus. Rows are marked `aria-disabled` and keep their DOM order. */
  public disabled = input(false, { transform: booleanAttribute });

  /**
   * Turns a `loadChildren` failure into the message shown on the branch that failed. The default shows an
   * `Error`'s `message` verbatim and a generic fallback for anything else.
   */
  public toErrorMessage = input<(error: unknown) => string>(
    (error) => (error instanceof Error && error.message) || 'Something went wrong',
  );

  /** A row was activated - clicked, or Enter'd. Fires for branches and leaves alike. */
  public nodeActivate = output<TreeNode<T>>();

  private levels = signal<TreeLevel<T>[]>([]);

  private registeredNodes = signal<TreeNodeLike<T>[]>([]);

  /** @internal The `etTreeNodeDef` row template, when one is projected. */
  public nodeTemplate = signal<TreeNodeDefLike<T> | null>(null);

  /**
   * The node holding roving focus, once the user has moved it. A row writes it on `focusin`, so the tab
   * stop stays where the user left it and Shift+Tab re-enters there.
   */
  public focusedNode = signal<TreeNode<T> | null>(null);

  /**
   * The flattened tree: every row that is currently visible, in DOM order - the root's children plus
   * the loaded children of every expanded branch below them.
   */
  public visibleRows = computed<TreeRow<T>[]>(() => {
    const compareWith = this.compareWith();
    const levels = this.levels();
    const expanded = this.expandedValues();
    const rows: TreeRow<T>[] = [];

    const levelOf = (parent: TreeNode<T> | null) =>
      levels.find((level) => nodesEqual({ a: level.parent, b: parent, compareWith })) ?? null;

    // `seen` guards against a malformed source whose branch contains its own value, which would
    // otherwise recurse until the stack gives out
    const walk = (options: {
      parent: TreeNode<T> | null;
      level: number;
      path: readonly TreeNode<T>[];
      seen: readonly T[];
    }) => {
      const { parent, level, path, seen } = options;
      const entry = levelOf(parent);

      if (!entry) return;

      entry.nodes.forEach((node, index) => {
        const isExpandable = canExpand(node);
        const children = isExpandable ? levelOf(node) : null;
        const isExpanded = isExpandable && expanded.some((value) => compareWith(value, node.value));
        const nodePath = [...path, node];

        rows.push({
          node,
          level,
          path: nodePath,
          isExpandable,
          isExpanded,
          isDisabled: node.disabled === true,
          childrenStatus: children?.status ?? TREE_LEVEL_STATUSES.IDLE,
          childrenError: children?.error ?? null,
          posInSet: index + 1,
          setSize: entry.nodes.length,
        });

        if (isExpanded && !seen.some((value) => compareWith(value, node.value))) {
          walk({ parent: node, level: level + 1, path: nodePath, seen: [...seen, node.value] });
        }
      });
    };

    walk({ parent: null, level: 1, path: [], seen: [] });

    return rows;
  });

  /** Load state of the root level - what a tree shows a loading or empty state for. */
  public rootStatus = computed(() => this.levelOf(null)?.status ?? TREE_LEVEL_STATUSES.IDLE);

  /** The message from a failed root load, or `null`. */
  public rootError = computed(() => this.levelOf(null)?.error ?? null);

  /** The selected values, normalized to an array (empty for no selection). */
  public values = computed<T[]>(() => {
    const value = this.value();

    if (Array.isArray(value)) {
      return value;
    }

    return value === null || value === undefined ? [] : [value];
  });

  /**
   * The row that owns the tree's single tab stop: the focused node while it is still visible, else the
   * first row. A tree is one tab stop with the arrow keys moving inside it, so exactly one row is
   * tabbable at any time.
   */
  public activeNode = computed(() => {
    const rows = this.visibleRows();
    const focused = this.focusedNode();
    const compareWith = this.compareWith();

    if (focused && rows.some((row) => compareWith(row.node.value, focused.value))) {
      return focused;
    }

    return rows[0]?.node ?? null;
  });

  // type-to-focus by label across the visible rows - a deep tree cannot be navigated by name otherwise
  private typeahead = createTypeahead();

  constructor() {
    // Every branch that needs loading right now: the root, plus each expanded branch whose children
    // have not been requested yet. Expansion is therefore the only trigger a load ever needs - an
    // `expandedValues` set that was restored from storage loads its branches exactly like a click does.
    const idleParents = computed(() => {
      if (!this.dataSource()) return [];

      const parents: (TreeNode<T> | null)[] = [];

      if (this.rootStatus() === TREE_LEVEL_STATUSES.IDLE) {
        parents.push(null);
      }

      for (const row of this.visibleRows()) {
        if (row.isExpanded && row.childrenStatus === TREE_LEVEL_STATUSES.IDLE) {
          parents.push(row.node);
        }
      }

      return parents;
    });

    // created here rather than inside the switchMap below, which is not an injection context
    const idleParents$ = toObservable(idleParents);

    toObservable(this.dataSource)
      .pipe(
        switchMap((source) => {
          // a swapped source describes a different tree - drop what was learned from the old one, and
          // let switchMap cancel its in-flight loads so a late response cannot write into the new tree
          untracked(() => {
            this.levels.set([]);
            this.focusedNode.set(null);
          });

          if (!source) return EMPTY;

          // mergeMap, not switchMap: sibling branches expanded in quick succession all load
          return idleParents$.pipe(mergeMap((parents) => merge(...parents.map((parent) => this.load(source, parent)))));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    inject(DestroyRef).onDestroy(() => this.typeahead.destroy());

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.dataSource()) {
          throw new RuntimeError(
            TREE_ERROR_CODES.MISSING_DATA_SOURCE,
            '[TreeDirective] A [dataSource] is required - without one the tree has nothing to load. ' +
              'Bind an object with a loadChildren(parent) method.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** Whether a node is expanded. */
  public isExpanded(node: TreeNode<T>) {
    const compareWith = this.compareWith();

    return this.expandedValues().some((value) => compareWith(value, node.value));
  }

  /** Whether a node is selected. */
  public isSelected(node: TreeNode<T>) {
    const compareWith = this.compareWith();

    return this.values().some((value) => compareWith(value, node.value));
  }

  /** Expand a branch, loading its children if this is the first time. No-op on leaves and disabled nodes. */
  public expand(node: TreeNode<T>) {
    if (this.disabled() || node.disabled || !canExpand(node) || this.isExpanded(node)) return;

    this.expandedValues.update((values) => [...values, node.value]);
  }

  /** Collapse a branch. Its children stay loaded, so re-expanding it is instant. */
  public collapse(node: TreeNode<T>) {
    if (this.disabled()) return;

    const compareWith = this.compareWith();

    this.expandedValues.update((values) => values.filter((value) => !compareWith(value, node.value)));
  }

  public toggleExpansion(node: TreeNode<T>) {
    if (this.isExpanded(node)) {
      this.collapse(node);
    } else {
      this.expand(node);
    }
  }

  /**
   * Expand every branch loaded so far. On a lazy source that is one level deeper than what is currently
   * visible: call it again once the newly loaded branches arrive to keep going.
   */
  public expandAll() {
    if (this.disabled()) return;

    const compareWith = this.compareWith();
    const expandable = this.levels()
      .flatMap((level) => level.nodes)
      .filter((node) => canExpand(node) && !node.disabled);

    this.expandedValues.update((values) => [
      ...values,
      ...expandable.filter((node) => !values.some((value) => compareWith(value, node.value))).map((node) => node.value),
    ]);
  }

  public collapseAll() {
    if (this.disabled()) return;

    this.expandedValues.set([]);
  }

  /** Reload a branch's children - what a failed load is retried with. Pass `null` for the root. */
  public retry(parent: TreeNode<T> | null) {
    this.setLevel(parent, { status: TREE_LEVEL_STATUSES.IDLE, nodes: [], error: null });
  }

  /** Select a node. No-op while `selectionMode` is `'none'`. */
  public select(node: TreeNode<T>) {
    if (this.disabled() || node.disabled || this.selectionMode() === TREE_SELECTION_MODES.NONE) return;

    if (this.selectionMode() === TREE_SELECTION_MODES.MULTIPLE) {
      if (this.isSelected(node)) return;

      this.value.set([...this.values(), node.value]);

      return;
    }

    this.value.set(node.value);
  }

  public deselect(node: TreeNode<T>) {
    if (this.disabled() || !this.isSelected(node)) return;

    const compareWith = this.compareWith();

    if (this.selectionMode() === TREE_SELECTION_MODES.MULTIPLE) {
      this.value.set(this.values().filter((value) => !compareWith(value, node.value)));

      return;
    }

    this.value.set(null);
  }

  /** Multiple mode: add the node to the selection, or remove it when already selected. */
  public toggleSelection(node: TreeNode<T>) {
    if (this.isSelected(node)) {
      this.deselect(node);
    } else {
      this.select(node);
    }
  }

  public clearSelection() {
    this.value.set(this.selectionMode() === TREE_SELECTION_MODES.MULTIPLE ? [] : null);
  }

  /**
   * What a click or Enter on a row does: move roving focus there, retry a branch whose children failed to
   * load, otherwise expand/collapse it, and apply the selection for the current mode. Always emits
   * {@link nodeActivate}, so a leaf can be "opened" without being selected.
   */
  public activate(node: TreeNode<T>) {
    if (this.disabled() || node.disabled) return;

    this.focusNode(node);

    const row = this.rowOf(node);

    if (row?.childrenError) {
      this.retry(node);
    } else if (canExpand(node)) {
      this.toggleExpansion(node);
    }

    if (this.selectionMode() === TREE_SELECTION_MODES.MULTIPLE) {
      this.toggleSelection(node);
    } else {
      this.select(node);
    }

    this.nodeActivate.emit(node);
  }

  /** Move roving focus - and DOM focus, when the row is rendered - to a node. */
  public focusNode(node: TreeNode<T>) {
    this.focusedNode.set(node);

    const compareWith = this.compareWith();
    const element = this.registeredNodes().find((registered) => compareWith(registered.row().node.value, node.value))
      ?.elementRef.nativeElement;

    if (!element) return;

    element.focus({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** Move focus to the tree's first row - where a fresh Tab lands. */
  public focusFirst() {
    const first = this.visibleRows()[0]?.node;

    if (first) {
      this.focusNode(first);
    }
  }

  /** @internal Called from a node's constructor; the registration is undone when the row is destroyed. */
  public registerNode(node: TreeNodeLike<T>) {
    this.registeredNodes.update((nodes) => [...nodes, node]);

    inject(DestroyRef).onDestroy(() =>
      this.registeredNodes.update((nodes) => nodes.filter((candidate) => candidate !== node)),
    );
  }

  /** @internal Routes a row's keydown through the tree navigation model. */
  public handleNodeKeydown(event: KeyboardEvent, node: TreeNode<T>) {
    if (event.ctrlKey || event.metaKey || event.altKey || this.disabled()) return;

    const rows = this.visibleRows();
    const compareWith = this.compareWith();
    const index = rows.findIndex((row) => compareWith(row.node.value, node.value));
    const row = rows[index];

    if (!row) return;

    // ArrowRight/ArrowLeft expand and collapse, which means they follow the writing direction
    const rtl = getComputedStyle(this.hostElement).direction === 'rtl';
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusRow(rows, index + 1);

        return;
      case 'ArrowUp':
        event.preventDefault();
        this.focusRow(rows, index - 1);

        return;
      case 'Home':
        event.preventDefault();
        this.focusRow(rows, 0);

        return;
      case 'End':
        event.preventDefault();
        this.focusRow(rows, rows.length - 1);

        return;
      case expandKey:
        event.preventDefault();

        if (row.isExpandable && !row.isExpanded) {
          this.expand(node);
        } else if (row.isExpanded && rows[index + 1]?.level === row.level + 1) {
          this.focusRow(rows, index + 1);
        }

        return;
      case collapseKey:
        event.preventDefault();

        if (row.isExpanded) {
          this.collapse(node);

          return;
        }

        // to the parent - the closest row above that sits one level up
        for (let candidate = index - 1; candidate >= 0; candidate--) {
          if (rows[candidate]?.level === row.level - 1) {
            this.focusRow(rows, candidate);

            return;
          }
        }

        return;
      case 'Enter':
        event.preventDefault();
        this.activate(node);

        return;
      case ' ':
        if (this.selectionMode() === TREE_SELECTION_MODES.NONE) return;

        event.preventDefault();

        if (this.selectionMode() === TREE_SELECTION_MODES.MULTIPLE) {
          this.toggleSelection(node);
        } else {
          this.select(node);
        }

        return;
      case '*':
        event.preventDefault();
        this.expandSiblings(rows, row);

        return;
    }

    if (event.key.length !== 1) return;

    const query = this.typeahead.append(event.key);
    // start after the focused row and wrap, so repeating a letter walks through the matches
    const match = rows
      .slice(index + 1)
      .concat(rows.slice(0, index + 1))
      .find((candidate) => !candidate.isDisabled && candidate.node.label.toLowerCase().startsWith(query));

    if (match) {
      event.preventDefault();
      this.focusNode(match.node);
    }
  }

  private levelOf(parent: TreeNode<T> | null) {
    const compareWith = this.compareWith();

    return this.levels().find((level) => nodesEqual({ a: level.parent, b: parent, compareWith })) ?? null;
  }

  private rowOf(node: TreeNode<T>) {
    const compareWith = this.compareWith();

    return this.visibleRows().find((row) => compareWith(row.node.value, node.value)) ?? null;
  }

  private focusRow(rows: readonly TreeRow<T>[], index: number) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];

    if (row) {
      this.focusNode(row.node);
    }
  }

  /** `*` expands every branch at the focused row's level that shares its parent. */
  private expandSiblings(rows: readonly TreeRow<T>[], row: TreeRow<T>) {
    const compareWith = this.compareWith();
    const parent = row.path[row.path.length - 2] ?? null;

    for (const candidate of rows) {
      if (
        candidate.level === row.level &&
        nodesEqual({ a: candidate.path[candidate.path.length - 2] ?? null, b: parent, compareWith })
      ) {
        this.expand(candidate.node);
      }
    }
  }

  private load(source: TreeDataSource<T>, parent: TreeNode<T> | null) {
    // The request was queued from a state that has since changed - the source was swapped, or the
    // branch collapsed again while `toObservable` was still holding this list. Reading the current
    // set is what keeps a re-emission from loading the same branch twice.
    if (!this.isIdle(parent)) return EMPTY;

    this.setLevel(parent, { status: TREE_LEVEL_STATUSES.LOADING, nodes: [], error: null });

    // defer, so a `loadChildren` that throws on the spot fails the branch like a rejected load
    // rather than tearing down the whole pipeline
    return defer(() => toChildrenObservable(source.loadChildren(parent))).pipe(
      take(1),
      tap({
        next: (nodes) => this.setLevel(parent, { status: TREE_LEVEL_STATUSES.LOADED, nodes, error: null }),
        error: (error) =>
          this.setLevel(parent, {
            status: TREE_LEVEL_STATUSES.ERROR,
            nodes: [],
            error: this.toErrorMessage()(error),
          }),
      }),
      catchError(() => EMPTY),
    );
  }

  private isIdle(parent: TreeNode<T> | null) {
    const level = this.levelOf(parent);

    if (level !== null && level.status !== TREE_LEVEL_STATUSES.IDLE) {
      return false;
    }

    return parent === null || this.isExpanded(parent);
  }

  private setLevel(parent: TreeNode<T> | null, state: Omit<TreeLevel<T>, 'parent'>) {
    const compareWith = this.compareWith();

    this.levels.update((levels) => [
      ...levels.filter((level) => !nodesEqual({ a: level.parent, b: parent, compareWith })),
      { parent, ...state },
    ]);
  }
}
