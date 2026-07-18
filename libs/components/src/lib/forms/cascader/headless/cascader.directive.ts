import {
  DOCUMENT,
  DestroyRef,
  Directive,
  Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError, nextFrame } from '@ethlete/core';
import { EMPTY, Subscription, catchError, fromEvent, merge, switchMap, take, tap } from 'rxjs';
import { createTypeahead } from '../../../internals/typeahead';
import { anchoredOverlayStrategy, injectBottomSheetStrategy } from '../../../overlay/strategies';
import {
  AnchoredPanelOverlayRef,
  createAnchoredPanelController,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  isInteractiveElement,
} from '../../form-field/headless';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderColumnState, CascaderSearchState } from './cascader.tokens';
import {
  CascaderCompareWith,
  CascaderDataSource,
  CascaderNode,
  canHaveChildren,
  defaultCompareWith,
  indexOfNode,
  nodesEqual,
  toChildrenObservable,
  toPathObservable,
  toSearchObservable,
} from './internals/cascader-tree';

export const CASCADER_SELECTABLE_LEVELS = {
  /** Only terminal leaves commit a value (default). */
  LEAF: 'leaf',
  /** Any node — including intermediate branches — can be committed. */
  ANY: 'any',
} as const;

export type CascaderSelectableLevels = (typeof CASCADER_SELECTABLE_LEVELS)[keyof typeof CASCADER_SELECTABLE_LEVELS];

type CascaderSurfaceLike = { templateRef: unknown };
type CascaderTriggerLike = { elementRef: { nativeElement: HTMLElement } };
type CascaderSearchLike = {
  clear(): void;
  focus(options?: { select?: boolean }): void;
  isFocused(): boolean;
  appendCharacter(character: string): void;
};

@Directive({
  selector: '[etCascader]',
  exportAs: 'etCascader',
  host: {
    '[attr.data-cascader-open]': 'open() || null',
  },
})
export class CascaderDirective<T = unknown> implements FormValueControl<T | T[] | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private bottomSheetStrategy = injectBottomSheetStrategy();

  /** The committed value: `T | null` in single mode, `T[]` with `multiple`. */
  public value = model<T | T[] | null>(null);
  public touched = model(false);
  public open = model(false);
  public disabled = input(false);
  public readonly = input(false);
  /** Multi-select: node activations toggle values instead of committing-and-closing. */
  public multiple = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /** The hierarchical source browsed by the cascader. Required. */
  public dataSource = input<CascaderDataSource<T> | null>(null);

  /** Whether only leaves (`'leaf'`, default) or any node (`'any'`) can be committed as the value. */
  public selectableLevels = input<CascaderSelectableLevels>(CASCADER_SELECTABLE_LEVELS.LEAF);

  /** Value equality — override when values are objects. */
  public compareWith = input<CascaderCompareWith<T>>(defaultCompareWith);

  /**
   * Turns a `loadChildren` / `search` failure into the error text shown in the panel. The default
   * shows an `Error`'s `message` verbatim (sources like `cascaderFromQuery` throw display-ready
   * messages) and a generic fallback for anything else.
   */
  public toErrorMessage = input<(error: unknown) => string>(
    (error) => (error instanceof Error && error.message) || 'Something went wrong',
  );

  /** Whether the overlay panel mirrors the anchor's width (off — columns size themselves). */
  public mirrorPanelWidth = input(false);

  public opened = output<void>();
  public closed = output<void>();

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  /** The committed values, normalized to an array (one entry in single mode, empty for no value). */
  public values = computed<T[]>(() => {
    const value = this.value();

    if (Array.isArray(value)) {
      return value;
    }

    return value === null || value === undefined ? [] : [value];
  });

  public hasValue = computed(() => this.values().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.CASCADER);

  /** @internal Set by the trigger. The field also counts as focused while the panel is open. */
  public triggerFocused = signal(false);
  public focused = computed(() => this.triggerFocused() || this.open());

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredTrigger = signal<CascaderTriggerLike | null>(null);
  /** @internal */
  public registeredSurface = signal<CascaderSurfaceLike | null>(null);
  /** @internal */
  public registeredSearch = signal<CascaderSearchLike | null>(null);
  /** @internal The mounted tree panel's element id — the trigger points `aria-controls` at it. */
  public panelId = signal<string | null>(null);

  /** The columns currently shown — column 0 is the root, each subsequent one a drilled level. */
  public columns = signal<CascaderColumnState<T>[]>([]);

  /** The chain of nodes drilled into — `openPath[i]` is the parent of column `i + 1`. */
  private openPath = signal<CascaderNode<T>[]>([]);

  /** The committed selection chain from root to the chosen node (for the breadcrumb trigger). */
  public path = signal<CascaderNode<T>[]>([]);
  public pathValue = computed(() => this.path().map((node) => node.value));

  /**
   * Multi mode: the known chain (root → selected node) per selected value — filled by in-panel
   * toggles and, for programmatically set values, by the data source's `resolvePath`. A value
   * whose chain is unknown yet has no entry here (its label can't be displayed until resolved).
   */
  public selectedPaths = signal<CascaderNode<T>[][]>([]);

  /** The label of the current value, or `null` (show the placeholder). */
  public displayPath = computed(() => this.path().map((node) => node.label));
  public displayValue = computed(() => {
    if (this.multiple()) {
      // one label per selected node (not the full breadcrumb — several would not scan)
      const compareWith = this.compareWith();
      const paths = this.selectedPaths();
      const labels = this.values()
        .map((value) => {
          const chain = paths.find((path) => {
            const last = path[path.length - 1];

            return last !== undefined && compareWith(last.value, value);
          });

          return chain?.[chain.length - 1]?.label ?? (typeof value === 'string' ? value : null);
        })
        .filter((label): label is string => label !== null);

      return labels.length ? labels.join(', ') : null;
    }

    const labels = this.displayPath();

    return labels.length ? labels.join(' / ') : null;
  });

  /** The node holding roving focus, and the column it lives in. */
  public focusedNode = signal<CascaderNode<T> | null>(null);
  public focusedColumn = signal(0);
  /** @internal Whether DOM focus is inside the panel — gates the roving-focus DOM moves. */
  public focusInside = signal(false);
  /**
   * @internal Bumped after the panel settles to (re-)pull DOM focus onto the active node —
   * the opening pointer click focuses the trigger a frame after the node's focus effect runs.
   */
  public focusPulse = signal(0);

  /** @internal */
  public overlayRef = signal<AnchoredPanelOverlayRef | null>(null);
  public isMounted = computed(() => this.overlayRef() !== null);

  /** Whether the data source supports flat search — the presence of its `search` hook. */
  public canSearch = computed(() => !!this.dataSource()?.search);

  /** The raw flat-search query, written by the registered search input. */
  public searchQuery = signal('');

  /** Whether a flat search is active — a non-blank query on a searchable source. */
  public isSearching = computed(() => this.canSearch() && this.searchQuery().trim().length > 0);

  /** The flat search's load state and matching paths (root → matching node chains). */
  public searchState = signal<CascaderSearchState<T>>({ status: 'idle', results: [], error: null });

  /** @internal Index of the search result holding roving focus — `-1` while the input has it. */
  public focusedSearchIndex = signal(-1);

  private searchRetry = signal(0);

  private searchRequest = computed(() => {
    const source = this.dataSource();
    const search = source?.search;

    if (!source || !search || !this.isSearching()) {
      return null;
    }

    return { source, search, query: this.searchQuery().trim(), retry: this.searchRetry() };
  });

  private panel = createAnchoredPanelController({
    canOpen: computed(() => !this.disabled()),
    open: this.open,
    overlayRef: this.overlayRef,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    config: ({ origin }) => {
      const context = { $implicit: this, cascader: this, close: () => this.hide() };

      return {
        bindings: [
          inputBinding('template', () => this.registeredSurface()?.templateRef),
          inputBinding('context', () => context),
        ],
        mode: 'non-modal',
        autoFocus: false,
        restoreFocus: false,
        // Escape is owned by handlePanelKeydown (clear the search query first, close second) —
        // the runtime's capture-phase handler would close before the search input saw the key
        closeOnEscape: false,
        closeOnOutsidePointer: false,
        origin,
        panelClass: 'et-cascader-overlay-pane',
        strategies: () => [
          {
            strategy: this.bottomSheetStrategy.build({ hasBackdrop: true, containerClass: 'et-cascader-sheet' }),
          },
          ...anchoredOverlayStrategy({
            containerClass: ['et-overlay--anchored', 'et-overlay--cascader'],
            placement: 'bottom-start',
            fallbackPlacements: ['top-start'],
            offset: 4,
            viewportPadding: 8,
            autoResize: true,
            shift: { crossAxis: true },
            mirrorWidth: this.mirrorPanelWidth(),
          })().map((entry) => ({ ...entry, breakpoint: 'md' as const })),
        ],
      };
    },
    onBeforeMount: () => {
      this.resetBrowseState();

      // a tree popup takes focus on open (menu pattern): mark focus as inside so the seeded
      // roving node pulls DOM focus once it renders, and keyboard navigation works immediately
      this.focusInside.set(true);

      // the opening pointer click focuses the trigger one frame *after* the node's focus effect
      // runs, stealing focus back — re-pull it onto the active node once everything has settled
      nextFrame(() => {
        if (!this.overlayRef()) {
          return;
        }

        const search = this.registeredSearch();

        if (!search) {
          this.focusPulse.update((pulse) => pulse + 1);

          return;
        }

        // with a search box the input takes initial focus (menu pattern): typing filters
        // immediately, ArrowDown moves roving focus into the tree. The pane may not be
        // focusable while its enter transition settles — retry until the focus sticks.
        const attempt = (remaining: number) => {
          if (!this.overlayRef()) {
            return;
          }

          search.focus();

          if (!search.isFocused() && remaining > 0) {
            requestAnimationFrame(() => attempt(remaining - 1));
          }
        };

        attempt(20);
      });
    },
    onMounted: () => this.opened.emit(),
    onDocumentKeydown: (event) => this.handlePanelKeydown(event),
    onAfterClosed: ({ byOutsidePointer }) => {
      this.focusInside.set(false);
      this.closed.emit();

      if (!byOutsidePointer && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
  });

  private loadSubscriptions = new Map<number, Subscription>();

  /** The deepest column index currently shown — the visible column in sheet (drill) mode. */
  public deepestColumnIndex = computed(() => Math.max(0, this.columns().length - 1));

  /** Direction of the last column navigation — drives the panel's slide animation. `null` on open. */
  public navigationDirection = signal<'forward' | 'backward' | null>(null);

  /**
   * How the sheet header title animates on the last navigation. `'slide'` (a directional
   * cross-slide) for level changes that keep the Back bar; `'fade'` when the nav crosses the
   * root boundary (Back appears/disappears) — there the title also shifts horizontally as the
   * Back bar's width animates, so a competing transform slide would look jumpy.
   */
  public titleAnimation = signal<'slide' | 'fade'>('slide');

  // type-to-search within the focused column (long columns can't be navigated by name otherwise);
  // the buffer resets when focus moves to a different column so queries don't leak across levels
  private typeahead = createTypeahead();
  private typeaheadColumn = -1;

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    // clear the browse state whenever the value is externally reset to nothing, so a
    // reopened panel starts at the root instead of a stale branch — and in multi mode,
    // prune the known chains of values that were removed from outside
    effect(() => {
      const value = this.value();

      untracked(() => {
        if (this.multiple()) {
          const values = this.values();
          const compareWith = this.compareWith();
          const paths = this.selectedPaths();
          const pruned = paths.filter((path) => {
            const last = path[path.length - 1];

            return last !== undefined && values.some((candidate) => compareWith(candidate, last.value));
          });

          if (pruned.length !== paths.length) {
            this.selectedPaths.set(pruned);
          }

          return;
        }

        if ((value === null || value === undefined) && this.path().length) {
          this.path.set([]);
        }
      });
    });

    // rebuild the breadcrumb when the value is set from outside (form patch/restore): `commit()`
    // already sets `path` alongside the value, so an internal commit's path ends at the value and
    // is skipped here. Only a value the panel didn't pick reaches `resolvePath` — an optional
    // data-source hook, since the cascader can't reverse a lazy tree on its own.
    toObservable(this.value)
      .pipe(
        switchMap((value) => {
          const compareWith = this.compareWith();
          const resolvePath = this.dataSource()?.resolvePath;

          // multi mode: resolve the chain of every value that wasn't picked in the panel
          // (a form patch/restore), so labels and indeterminate parents work for them too
          if (this.multiple()) {
            const missing = this.values().filter(
              (candidate) =>
                !this.selectedPaths().some((path) => {
                  const pathLast = path[path.length - 1];

                  return pathLast !== undefined && compareWith(pathLast.value, candidate);
                }),
            );

            if (!resolvePath || !missing.length) {
              return EMPTY;
            }

            return merge(
              ...missing.map((candidate) =>
                toPathObservable(resolvePath(candidate)).pipe(
                  tap((resolved) => {
                    // the value may have been deselected while resolving — drop the late chain
                    const stillSelected = this.values().some((current) => compareWith(current, candidate));
                    const resolvedLast = resolved?.[resolved.length - 1];

                    if (!stillSelected || !resolved || !resolvedLast || !compareWith(resolvedLast.value, candidate)) {
                      return;
                    }

                    this.selectedPaths.update((paths) => [
                      ...paths.filter((path) => {
                        const pathLast = path[path.length - 1];

                        return pathLast === undefined || !compareWith(pathLast.value, candidate);
                      }),
                      resolved,
                    ]);
                  }),
                  catchError(() => EMPTY),
                ),
              ),
            );
          }

          if (value === null || value === undefined || Array.isArray(value)) {
            return EMPTY;
          }

          const currentPath = this.path();
          const last = currentPath[currentPath.length - 1];

          // the committed path already ends at this value — nothing to resolve
          if (last && compareWith(last.value, value)) {
            return EMPTY;
          }

          if (!resolvePath) {
            return EMPTY;
          }

          return toPathObservable(resolvePath(value)).pipe(
            tap((resolved) => {
              // a later value change / clear superseded this (async) resolve — drop it
              const currentValue = this.value();

              if (
                currentValue === null ||
                currentValue === undefined ||
                Array.isArray(currentValue) ||
                !compareWith(currentValue, value)
              ) {
                return;
              }

              if (resolved && resolved.length && compareWith(resolved[resolved.length - 1]!.value, value)) {
                this.path.set(resolved);
              }
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // run the flat search as the (trimmed) query changes: switchMap cancels a stale in-flight
    // search, and each emission of a live source refreshes the result list
    toObservable(this.searchRequest)
      .pipe(
        switchMap((request) => {
          if (!request) {
            untracked(() => this.searchState.set({ status: 'idle', results: [], error: null }));

            return EMPTY;
          }

          untracked(() => {
            this.searchState.set({ status: 'loading', results: [], error: null });
            this.focusedSearchIndex.set(-1);
          });

          // .call keeps the data source as `this` — sources may implement `search` as a method
          return toSearchObservable(request.search.call(request.source, request.query)).pipe(
            tap({
              next: (results) => {
                this.searchState.set({ status: 'loaded', results, error: null });
                this.focusedSearchIndex.set(-1);
              },
              error: (error) =>
                this.searchState.set({ status: 'error', results: [], error: this.toErrorMessage()(error) }),
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // a click anywhere on the field's control frame opens the panel, like on the trigger
    toObservable(computed(() => this.formField?.controlFrameElement() ?? null))
      .pipe(
        switchMap((frame) => (frame ? fromEvent<MouseEvent>(frame, 'click') : EMPTY)),
        tap((event) => this.handleFrameClick(event)),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.destroyRef.onDestroy(() => {
      this.cancelLoads();
      this.typeahead.destroy();
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredTrigger()) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.MISSING_TRIGGER,
            '[CascaderDirective] Cascader trigger not found. Add an element with etCascaderTrigger inside the [etCascader] element.',
          );
        }

        if (!this.registeredSurface()) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.MISSING_SURFACE,
            '[CascaderDirective] Cascader surface not found. Add <ng-template etCascaderSurface> inside the [etCascader] element.',
          );
        }
      });
    }
  }

  public show() {
    if (this.disabled() || this.readonly() || this.open()) {
      return;
    }

    this.open.set(true);
  }

  public hide() {
    if (this.open()) {
      this.open.set(false);
    } else {
      this.panel.close();
    }
  }

  public toggle() {
    if (this.open()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus({ preventScroll: true });
  }

  /**
   * Whether a node is selected — on the committed chain in single mode, an exactly selected
   * value in multi mode (ancestors show as indeterminate there instead).
   */
  public isSelected(node: CascaderNode<T>) {
    if (this.multiple()) {
      return this.values().some((value) => this.compareWith()(value, node.value));
    }

    return this.path().some((selected) => this.compareWith()(selected.value, node.value));
  }

  /** Multi mode: whether an unselected node has a selected descendant (the dash state). */
  public isIndeterminate(node: CascaderNode<T>) {
    if (!this.multiple() || this.isSelected(node)) {
      return false;
    }

    const compareWith = this.compareWith();

    return this.selectedPaths().some((path) =>
      path.slice(0, -1).some((ancestor) => compareWith(ancestor.value, node.value)),
    );
  }

  /** Whether a node is expanded (its children fill the next column). */
  public isExpanded(node: CascaderNode<T>, columnIndex: number) {
    return nodesEqual({ a: this.openPath()[columnIndex] ?? null, b: node, compareWith: this.compareWith() });
  }

  /**
   * Activates a node from a pointer/keyboard interaction: drills into branches, commits leaves.
   * With `multiple`, activation toggles the node's value instead (and never closes) — branches
   * still just drill in leaf mode, and toggle **and** drill in any-level mode.
   */
  public activateNode(node: CascaderNode<T>, columnIndex: number) {
    if (this.disabled() || this.readonly() || node.disabled) {
      return;
    }

    this.focusNode(node, columnIndex);

    const chain = [...this.openPath().slice(0, columnIndex), node];

    if (canHaveChildren(node)) {
      this.drillInto(node, columnIndex);

      if (this.selectableLevels() === CASCADER_SELECTABLE_LEVELS.ANY) {
        if (this.multiple()) {
          this.toggleValue(chain);
        } else {
          this.commit({ node, columnIndex, close: false });
        }
      }

      return;
    }

    if (this.multiple()) {
      this.toggleValue(chain);

      return;
    }

    this.commit({ node, columnIndex, close: true });
  }

  /** Multi mode: adds the chain's final node to the value, or removes it when already selected. */
  public toggleValue(chain: CascaderNode<T>[]) {
    const node = chain[chain.length - 1];

    if (!node || this.disabled() || this.readonly()) {
      return;
    }

    const compareWith = this.compareWith();
    const values = this.values();
    const selected = values.some((value) => compareWith(value, node.value));

    if (selected) {
      this.value.set(values.filter((value) => !compareWith(value, node.value)));
      this.selectedPaths.update((paths) =>
        paths.filter((path) => {
          const last = path[path.length - 1];

          return last === undefined || !compareWith(last.value, node.value);
        }),
      );

      return;
    }

    this.value.set([...values, node.value]);
    this.selectedPaths.update((paths) => [...paths, [...chain]]);
  }

  /** Clears the committed value (and its breadcrumb). */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(this.multiple() ? [] : null);
    this.path.set([]);
    this.selectedPaths.set([]);
  }

  /** @internal Moves roving focus to a node without activating it. */
  public focusNode(node: CascaderNode<T>, columnIndex: number) {
    this.focusedNode.set(node);
    this.focusedColumn.set(columnIndex);
  }

  /** @internal Routes a node's keydown through the tree navigation model. */
  public handleNodeKeydown(event: KeyboardEvent, target: { node: CascaderNode<T>; columnIndex: number }) {
    const { node, columnIndex } = target;

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const column = this.columns()[columnIndex];

    if (!column) {
      return;
    }

    const nodes = column.nodes;
    const index = indexOfNode({ nodes, node, compareWith: this.compareWith() });

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        this.focusColumnNode(columnIndex, index + 1);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        this.focusColumnNode(columnIndex, index - 1);

        return;
      }
      case 'Home': {
        event.preventDefault();
        this.focusColumnNode(columnIndex, 0);

        return;
      }
      case 'End': {
        event.preventDefault();
        this.focusColumnNode(columnIndex, nodes.length - 1);

        return;
      }
      case 'ArrowRight': {
        event.preventDefault();

        if (canHaveChildren(node) && !node.disabled) {
          this.drillInto(node, columnIndex);
          // focus the first node of the freshly opened column once it loads
          this.focusFirstOfColumn(columnIndex + 1);
        }

        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();

        if (columnIndex > 0) {
          const parent = this.openPath()[columnIndex - 1];

          if (parent) {
            this.focusNode(parent, columnIndex - 1);
          }
        }

        return;
      }
    }

    if (event.key.length !== 1) {
      return;
    }

    // with a search input registered, typing on a node routes into the flat search instead
    const search = this.registeredSearch();

    if (search) {
      event.preventDefault();
      search.appendCharacter(event.key);

      return;
    }

    // type-to-search the focused column by node label (mirrors the select's typeahead)
    if (columnIndex !== this.typeaheadColumn) {
      this.typeahead.reset();
      this.typeaheadColumn = columnIndex;
    }

    const query = this.typeahead.append(event.key);
    const match = nodes.find((candidate) => !candidate.disabled && candidate.label.toLowerCase().startsWith(query));

    if (match) {
      event.preventDefault();
      this.focusNode(match, columnIndex);
    }
  }

  /** Collapses the deepest column and moves focus back to its parent — the sheet's back-nav. */
  public goBack() {
    const path = this.openPath();

    if (!path.length) {
      return;
    }

    const parent = path[path.length - 1]!;

    this.navigationDirection.set('backward');
    // returning to the root hides the Back bar (title shifts back to flush) — fade, not slide
    this.titleAnimation.set(path.length === 1 ? 'fade' : 'slide');
    this.openPath.update((current) => current.slice(0, -1));
    this.truncateColumns(this.openPath().length + 1);
    this.focusNode(parent, this.openPath().length);
  }

  /** @internal Reloads a column that errored — wired to the panel's retry control. */
  public retryColumn(columnIndex: number) {
    const column = this.columns()[columnIndex];

    if (column) {
      this.loadColumn(columnIndex, column.parent);
    }
  }

  /** @internal Updates the flat-search query (written by the registered search input). */
  public setSearchQuery(query: string) {
    if (ngDevMode && query && !this.canSearch()) {
      console.warn(
        '[CascaderDirective] A search query was typed but the [dataSource] has no `search` hook, so the query is ignored. Implement `search(query)` on the data source to enable flat search.',
      );
    }

    this.searchQuery.set(query);
    this.focusedSearchIndex.set(-1);
  }

  /** Clears the flat-search query (and with it the result list — the columns return). */
  public clearSearch() {
    const search = this.registeredSearch();

    if (search) {
      // clear() empties the input element and routes back through setSearchQuery('')
      search.clear();
    } else {
      this.searchQuery.set('');
    }

    this.focusedSearchIndex.set(-1);
  }

  /** Re-runs a failed search with the current query — wired to the panel's retry control. */
  public retrySearch() {
    this.searchRetry.update((count) => count + 1);
  }

  /** Activates a search result: commits selectable nodes, jumps the browse state to branch-only matches. */
  public activateSearchResult(path: CascaderNode<T>[]) {
    const node = path[path.length - 1];

    if (!node || node.disabled || this.disabled() || this.readonly()) {
      return;
    }

    // a branch match in leaf mode can't commit — re-root the columns onto it instead
    if (canHaveChildren(node) && this.selectableLevels() !== CASCADER_SELECTABLE_LEVELS.ANY) {
      this.browseToPath(path);
      this.clearSearch();

      return;
    }

    // multi mode: toggle the match and stay in the result list, so several hits of the same
    // search can be picked without retyping
    if (this.multiple()) {
      this.toggleValue(path);

      return;
    }

    // search is "jump straight to it": committing from a result always closes, including a
    // branch commit in any-level mode (unlike a browse click, which stays open to drill)
    this.path.set([...path]);
    this.value.set(node.value);
    this.hide();
  }

  /** @internal Enter in the search input activates the focused result, or the first enabled one. */
  public activateFocusedSearchResult() {
    const results = this.searchState().results;
    const path =
      results[this.focusedSearchIndex()] ?? results.find((candidate) => !candidate[candidate.length - 1]?.disabled);

    if (path) {
      this.activateSearchResult(path);
    }
  }

  /** @internal ArrowDown/ArrowUp from the search input moves roving focus into the panel. */
  public moveFocusFromSearch(direction: 1 | -1) {
    if (this.isSearching()) {
      const results = this.searchState().results;

      if (results.length) {
        this.focusedSearchIndex.set(direction === 1 ? 0 : results.length - 1);
      }

      return;
    }

    // browsing: hand DOM focus back to the roving tree node
    this.focusPulse.update((pulse) => pulse + 1);
  }

  /** @internal Moves roving focus to a search result without activating it. */
  public focusSearchOption(index: number) {
    const results = this.searchState().results;

    if (results.length) {
      this.focusedSearchIndex.set(Math.max(0, Math.min(results.length - 1, index)));
    }
  }

  /** @internal Routes a search result's keydown through the flat-list navigation model. */
  public handleSearchOptionKeydown(event: KeyboardEvent, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const search = this.registeredSearch();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        this.focusSearchOption(index + 1);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();

        // moving above the first result returns focus to the search input
        if (index === 0 && search) {
          this.focusedSearchIndex.set(-1);
          search.focus();

          return;
        }

        this.focusSearchOption(index - 1);

        return;
      }
      case 'Home': {
        event.preventDefault();
        this.focusSearchOption(0);

        return;
      }
      case 'End': {
        event.preventDefault();
        this.focusSearchOption(this.searchState().results.length - 1);

        return;
      }
    }

    // typing continues the query — focus returns to the input and the character lands there
    if (event.key.length === 1 && search) {
      event.preventDefault();
      this.focusedSearchIndex.set(-1);
      search.appendCharacter(event.key);
    }
  }

  private focusColumnNode(columnIndex: number, targetIndex: number) {
    const nodes = this.columns()[columnIndex]?.nodes ?? [];
    const clamped = Math.max(0, Math.min(nodes.length - 1, targetIndex));
    const node = nodes[clamped];

    if (node) {
      this.focusNode(node, columnIndex);
    }
  }

  private focusFirstOfColumn(columnIndex: number) {
    // the column may still be loading — retry on the next frame until it has nodes
    const attempt = (remaining: number) => {
      // the panel was closed/unmounted while the column was loading — stop, or we'd pull focus
      // into a node that is animating away
      if (!this.isMounted()) {
        return;
      }

      const nodes = this.columns()[columnIndex]?.nodes ?? [];

      if (nodes[0]) {
        this.focusNode(nodes[0], columnIndex);

        return;
      }

      if (remaining > 0) {
        requestAnimationFrame(() => attempt(remaining - 1));
      }
    };

    attempt(20);
  }

  /** Re-roots the browse state onto `path`, loading every column along it (its children get focus). */
  private browseToPath(path: CascaderNode<T>[]) {
    this.cancelLoads();
    this.openPath.set([...path]);
    this.columns.set([]);
    this.navigationDirection.set(null);
    this.focusedNode.set(null);

    this.loadColumn(0, null);
    path.forEach((node, index) => this.loadColumn(index + 1, node));

    // land keyboard focus on the first child of the branch that was jumped to
    this.focusFirstOfColumn(path.length);
  }

  private drillInto(node: CascaderNode<T>, columnIndex: number) {
    // already expanded here — nothing to reload
    if (this.isExpanded(node, columnIndex)) {
      return;
    }

    this.navigationDirection.set('forward');
    // crossing the root boundary (Back bar appears) shifts the title as the bar grows — fade
    // instead of a competing slide; deeper drills keep the directional cross-slide
    this.titleAnimation.set(columnIndex === 0 ? 'fade' : 'slide');
    this.openPath.update((path) => [...path.slice(0, columnIndex), node]);
    this.truncateColumns(columnIndex + 1);
    this.loadColumn(columnIndex + 1, node);
  }

  private commit(options: { node: CascaderNode<T>; columnIndex: number; close: boolean }) {
    const { node, columnIndex, close } = options;
    const chain = [...this.openPath().slice(0, columnIndex), node];

    this.path.set(chain);
    this.value.set(node.value);

    if (close) {
      this.hide();
    }
  }

  private truncateColumns(length: number) {
    for (const [index, subscription] of this.loadSubscriptions) {
      if (index >= length) {
        subscription.unsubscribe();
        this.loadSubscriptions.delete(index);
      }
    }

    this.columns.update((columns) => columns.slice(0, length));
  }

  private loadColumn(columnIndex: number, parent: CascaderNode<T> | null) {
    const source = this.dataSource();

    if (!source) {
      if (ngDevMode) {
        throw new RuntimeError(
          CASCADER_ERROR_CODES.MISSING_DATA_SOURCE,
          '[CascaderDirective] A [dataSource] is required to open the cascader.',
        );
      }

      return;
    }

    this.loadSubscriptions.get(columnIndex)?.unsubscribe();

    this.setColumn(columnIndex, { parent, status: 'loading', nodes: [], error: null });

    const subscription = toChildrenObservable(source.loadChildren(parent))
      .pipe(
        take(1),
        tap({
          next: (nodes) => {
            this.setColumn(columnIndex, { parent, status: 'loaded', nodes, error: null });

            // once the root column arrives, seed roving focus so keyboard navigation has a target
            if (columnIndex === 0 && !this.focusedNode() && nodes[0]) {
              this.focusNode(nodes[0], 0);
            }
          },
          error: (error) =>
            this.setColumn(columnIndex, { parent, status: 'error', nodes: [], error: this.toErrorMessage()(error) }),
        }),
        catchError(() => EMPTY),
      )
      .subscribe();

    this.loadSubscriptions.set(columnIndex, subscription);
  }

  private setColumn(columnIndex: number, state: CascaderColumnState<T>) {
    this.columns.update((columns) => {
      const next = columns.slice(0, columnIndex);

      next[columnIndex] = state;

      return next;
    });
  }

  private cancelLoads() {
    for (const subscription of this.loadSubscriptions.values()) {
      subscription.unsubscribe();
    }

    this.loadSubscriptions.clear();
  }

  // Escape is handled here instead of by the overlay runtime: with a search input the first
  // Escape only clears the query (the runtime's capture-phase handler would close before the
  // input ever saw the key).
  private handlePanelKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const search = this.registeredSearch();

    if (search && this.searchQuery()) {
      this.clearSearch();
      // the cleared result list may have held focus — hand it back to the input
      search.focus();

      return;
    }

    this.hide();
  }

  private resetBrowseState() {
    this.cancelLoads();
    this.openPath.set([]);
    this.columns.set([]);
    this.focusedColumn.set(0);
    // a query kept from the last open would filter the fresh panel — reset to browse mode
    this.searchQuery.set('');
    this.focusedSearchIndex.set(-1);
    // no slide animation for the columns present when the panel first opens
    this.navigationDirection.set(null);

    // seed focus to the committed root before loading — a set value re-opens where it left off,
    // and the guard in the root load skips its own seed. An empty value leaves focus null so the
    // root load seeds it to the first node instead. Multi re-opens onto the first known chain.
    const committed = this.multiple() ? (this.selectedPaths()[0] ?? []) : this.path();

    this.focusedNode.set(committed[0] ?? null);

    this.loadColumn(0, null);

    // re-open the committed branch so the panel lands where the value already is
    committed.forEach((node, index) => {
      if (canHaveChildren(node)) {
        this.openPath.update((path) => [...path, node]);
        this.loadColumn(index + 1, node);
      }
    });
  }

  private resolveAnchorElement() {
    return this.formField?.controlFrameElement() ?? this.registeredTrigger()?.elementRef.nativeElement ?? undefined;
  }

  private handleFrameClick(event: MouseEvent) {
    const target = event.target;
    const frame = event.currentTarget;

    if (!(target instanceof HTMLElement) || !(frame instanceof HTMLElement) || this.disabled() || this.readonly()) {
      return;
    }

    if (this.registeredTrigger()?.elementRef.nativeElement.contains(target)) {
      return;
    }

    for (let element: HTMLElement | null = target; element && element !== frame; element = element.parentElement) {
      if (isInteractiveElement(element)) {
        return;
      }
    }

    this.activate();
    this.toggle();
  }
}

export type CascaderSurfaceContext<T = unknown> = {
  $implicit: CascaderDirective<T>;
  cascader: CascaderDirective<T>;
  close: () => void;
};

export type CascaderNodeSignal<T> = Signal<CascaderNode<T> | null>;
