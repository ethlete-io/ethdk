import {
  DOCUMENT,
  DestroyRef,
  Directive,
  Signal,
  afterNextRender,
  booleanAttribute,
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
import { RuntimeError, injectHostElement, nextFrame } from '@ethlete/core';
import { EMPTY, Subscription, catchError, fromEvent, merge, switchMap, take, tap } from 'rxjs';
import { createTypeahead } from '../../../internals/typeahead';
import { mountFloatingPanelStyles } from '../../../overlay/floating-panel-styles.component';
import { anchoredOverlayStrategy, injectBottomSheetStrategy } from '../../../overlay/strategies';
import {
  AccessibleNameControlDirective,
  AnchoredPanelOverlayRef,
  createAnchoredPanelController,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  hitsInteractiveElement,
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
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';

export const CASCADER_SELECTABLE_LEVELS = {
  /** Only terminal leaves commit a value (default). */
  LEAF: 'leaf',
  /** Any node - including intermediate branches - can be committed. */
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
    '[attr.data-mixed]': 'mixed() || null',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-readonly]': 'readonly() || null',
  },
})
export class CascaderDirective<T = unknown>
  extends AccessibleNameControlDirective
  implements FormValueControl<T | T[] | null>, FormFieldControl
{
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private bottomSheetStrategy = injectBottomSheetStrategy();
  private hostElement = injectHostElement();

  /** The committed value: `T | null` in single mode, `T[]` with `multiple`. */
  public value = model<T | T[] | null>(null);
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public open = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  /** Multi-select: node activations toggle values instead of committing-and-closing. */
  public multiple = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');
  /** Trigger text shown while `mixed` is set. */
  public mixedLabel = input<string | null>(null);

  /** The hierarchical source browsed by the cascader. Required. */
  public dataSource = input<CascaderDataSource<T> | null>(null);

  /** Whether only leaves (`'leaf'`, default) or any node (`'any'`) can be committed as the value. */
  public selectableLevels = input<CascaderSelectableLevels>(CASCADER_SELECTABLE_LEVELS.LEAF);

  /** Value equality - override when values are objects. */
  public compareWith = input<CascaderCompareWith<T>>(defaultCompareWith);

  /**
   * Turns a `loadChildren` / `search` failure into the error text shown in the panel. The default
   * shows an `Error`'s `message` verbatim (sources like `cascaderFromQuery` throw display-ready
   * messages) and a generic fallback for anything else.
   */
  public toErrorMessage = input<(error: unknown) => string>(
    (error) => (error instanceof Error && error.message) || 'Something went wrong',
  );

  /** Whether the overlay panel mirrors the anchor's width (off - columns size themselves). */
  public mirrorPanelWidth = input(false, { transform: booleanAttribute });

  /**
   * How many columns the browse view shows side by side before older levels collapse into the
   * breadcrumb row (min 1).
   */
  public maxVisibleColumns = input(3, { transform: (value: number) => Math.max(1, Math.floor(value)) });

  public afterOpen = output<void>();
  public afterClose = output<void>();

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  /** The committed values, normalized to an array (one entry in single mode, empty for no value). */
  public values = computed<T[]>(() => {
    const value = this.value();

    if (Array.isArray(value)) {
      return value;
    }

    return value === null || value === undefined ? [] : [value];
  });

  public hasValue = computed(() => this.mixed() || this.values().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.CASCADER);

  /** @internal Set by the trigger. */
  public triggerFocused = signal(false);
  public focused = computed(() => this.triggerFocused() || this.open());

  /** @internal Keeps the form field in its focused style while the panel is open. */
  public expanded = computed(() => this.open());

  /** @internal */
  public registeredTrigger = signal<CascaderTriggerLike | null>(null);
  /** @internal */
  public registeredSurface = signal<CascaderSurfaceLike | null>(null);
  /** @internal */
  public registeredSearch = signal<CascaderSearchLike | null>(null);
  /** @internal The mounted tree panel's element id - the trigger points `aria-controls` at it. */
  public panelId = signal<string | null>(null);

  /** The columns currently shown - column 0 is the root, each subsequent one a drilled level. */
  public columns = signal<CascaderColumnState<T>[]>([]);

  /** The chain of nodes drilled into - `openPath[i]` is the parent of column `i + 1`. */
  private openPath = signal<CascaderNode<T>[]>([]);

  /**
   * Deliberately unclamped - columns load and truncate asynchronously, so the clamp lives in
   * `visibleColumnStart` where it tracks the current column count instead of going stale.
   */
  private columnWindowStart = signal(0);

  /** Index of the first column the browse view shows - everything before it is collapsed. */
  public visibleColumnStart = computed(() => {
    const overflow = Math.max(0, this.columns().length - this.maxVisibleColumns());

    return Math.max(0, Math.min(overflow, this.columnWindowStart()));
  });

  /** The windowed slice of `columns` the browse view renders, with their absolute indices. */
  public visibleColumns = computed(() => {
    const start = this.visibleColumnStart();

    return this.columns()
      .slice(start, start + this.maxVisibleColumns())
      .map((column, offset) => ({ column, columnIndex: start + offset }));
  });

  /**
   * The breadcrumb row's entries: the FULL drilled trail, present whenever the drill overflows
   * the window (empty otherwise). Deliberately independent of the window position - levels
   * collapsed to the right (after sliding back) need their crumbs just as much as those on the
   * left, and sliding around must never rebuild the row; only an actual drill change does.
   */
  public breadcrumbPath = computed(() =>
    this.columns().length > this.maxVisibleColumns() ? [...this.openPath()] : [],
  );

  /** The committed selection chain from root to the chosen node (for the breadcrumb trigger). */
  public path = signal<CascaderNode<T>[]>([]);
  public pathValue = computed(() => this.path().map((node) => node.value));

  /**
   * Multi mode: the known chain (root → selected node) per selected value - filled by in-panel
   * toggles and, for programmatically set values, by the data source's `resolvePath`. A value
   * whose chain is unknown yet has no entry here (its label can't be displayed until resolved).
   */
  public selectedPaths = signal<CascaderNode<T>[][]>([]);

  /** Every child list loaded so far, keyed by parent (`null` = root). */
  private knownChildren = signal<{ parent: CascaderNode<T> | null; children: CascaderNode<T>[] }[]>([]);

  public displayPath = computed(() => this.path().map((node) => node.label));
  public displayValue = computed(() => {
    if (this.mixed()) {
      return this.resolvedMixedLabel();
    }

    if (this.multiple()) {
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
  /** @internal Whether DOM focus is inside the panel - gates the roving-focus DOM moves. */
  public focusInside = signal(false);
  /** @internal Bumped after the panel settles to (re-)pull DOM focus onto the active node. */
  public focusPulse = signal(0);

  /** @internal */
  public overlayRef = signal<AnchoredPanelOverlayRef | null>(null);
  public isMounted = computed(() => this.overlayRef() !== null);

  /** Whether the data source supports flat search - the presence of its `search` hook. */
  public canSearch = computed(() => !!this.dataSource()?.search);

  /** The raw flat-search query, written by the registered search input. */
  public searchQuery = signal('');

  /** Whether a flat search is active - a non-blank query on a searchable source. */
  public isSearching = computed(() => this.canSearch() && this.searchQuery().trim().length > 0);

  /** The flat search's load state and matching paths (root → matching node chains). */
  public searchState = signal<CascaderSearchState<T>>({ status: 'idle', results: [], error: null });

  /** @internal Index of the search result holding roving focus - `-1` while the input has it. */
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
        // Escape is owned by handlePanelKeydown (clear the search query first, close second) -
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
            containerClass: ['et-overlay--anchored', 'et-overlay--cascader', 'et-floating-panel'],
            placement: 'bottom-start',
            offset: 4,
            viewportPadding: 8,
            autoResize: true,
            minAvailableSpace: 160,
            mirrorWidth: this.mirrorPanelWidth(),
          })().map((entry) => ({ ...entry, breakpoint: 'md' as const })),
        ],
      };
    },
    onBeforeMount: () => {
      this.resetBrowseState();

      this.focusInside.set(true);

      // the opening pointer click focuses the trigger one frame *after* the node's focus effect
      // runs, stealing focus back - re-pull it onto the active node once everything has settled
      nextFrame(() => {
        if (!this.overlayRef()) {
          return;
        }

        const search = this.registeredSearch();

        if (!search) {
          this.focusPulse.update((pulse) => pulse + 1);

          return;
        }

        // the pane may not be focusable while its enter transition settles - retry until the
        // focus sticks
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
    onMounted: () => this.afterOpen.emit(),
    onDocumentKeydown: (event) => this.handlePanelKeydown(event),
    onAfterClosed: ({ byOutsidePointer, byFocusLeave }) => {
      this.focusInside.set(false);
      this.afterClose.emit();

      if (!byOutsidePointer && !byFocusLeave && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
  });

  private loadSubscriptions = new Map<number, Subscription>();

  /** The deepest column index currently shown - the visible column in sheet (drill) mode. */
  public deepestColumnIndex = computed(() => Math.max(0, this.columns().length - 1));

  /** Direction of the last column navigation - drives the panel's slide animation. `null` on open. */
  public navigationDirection = signal<'forward' | 'backward' | null>(null);

  /**
   * How the sheet header title animates on the last navigation. `'slide'` (a directional
   * cross-slide) for level changes that keep the Back bar; `'fade'` when the nav crosses the
   * root boundary (Back appears/disappears) - there the title also shifts horizontally as the
   * Back bar's width animates, so a competing transform slide would look jumpy.
   */
  public titleAnimation = signal<'slide' | 'fade'>('slide');

  private typeahead = createTypeahead();
  private typeaheadColumn = -1;

  constructor() {
    super();

    mountTextFieldShellStyles();
    mountFloatingPanelStyles();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    // a swapped data source describes a different tree - drop the child lists learned from
    // the old one so they can't promote branches of the new one to fully selected
    effect(() => {
      this.dataSource();

      untracked(() => this.knownChildren.set([]));
    });

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

        const path = this.path();

        if (!path.length) {
          return;
        }

        const last = path[path.length - 1];
        const matchesValue =
          last !== undefined &&
          value !== null &&
          value !== undefined &&
          !Array.isArray(value) &&
          this.compareWith()(last.value, value);

        if (!matchesValue) {
          this.path.set([]);
        }
      });
    });

    toObservable(this.value)
      .pipe(
        switchMap((value) => {
          const compareWith = this.compareWith();
          const resolvePath = this.dataSource()?.resolvePath;

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

          if (last && compareWith(last.value, value)) {
            return EMPTY;
          }

          if (!resolvePath) {
            return EMPTY;
          }

          return toPathObservable(resolvePath(value)).pipe(
            tap((resolved) => {
              const currentValue = this.value();

              if (
                currentValue === null ||
                currentValue === undefined ||
                Array.isArray(currentValue) ||
                !compareWith(currentValue, value)
              ) {
                return;
              }

              if (resolved && resolved.length) {
                const last = resolved[resolved.length - 1];

                if (last && compareWith(last.value, value)) {
                  this.path.set(resolved);
                }
              }
            }),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

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

          // .call keeps the data source as `this` - sources may implement `search` as a method
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
            { element: this.hostElement },
          );
        }

        if (!this.registeredSurface()) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.MISSING_SURFACE,
            '[CascaderDirective] Cascader surface not found. Add <ng-template etCascaderSurface> inside the [etCascader] element.',
            { element: this.hostElement },
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
    this.focus({ preventScroll: true });
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus(options);
  }

  /**
   * Whether a node is selected - on the committed chain in single mode; in multi mode an
   * exactly selected value, or a branch whose loaded descendants are all selected (ancestors
   * of a partial selection show as indeterminate instead).
   */
  public isSelected(node: CascaderNode<T>) {
    // mixed masks the raw selection: nothing reports selected until the user commits
    if (this.mixed()) {
      return false;
    }

    if (this.multiple()) {
      return this.isFullySelected(node, []);
    }

    return this.path().some((selected) => this.compareWith()(selected.value, node.value));
  }

  /** Multi mode: whether a node that isn't (fully) selected has a selected descendant (the dash state). */
  public isIndeterminate(node: CascaderNode<T>) {
    if (!this.multiple() || this.mixed() || this.isSelected(node)) {
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
   * With `multiple`, activation toggles the node's value instead (and never closes) - branches
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

    // the first commit over a mixed value REPLACES: a fresh array around the toggled node,
    // never a toggle against the hidden raw selection
    if (this.mixed()) {
      this.value.set([node.value]);
      this.selectedPaths.set([[...chain]]);
      this.mixed.set(false);

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
    this.mixed.set(false);
    this.path.set([]);
    this.selectedPaths.set([]);
  }

  /** @internal Moves roving focus to a node without activating it. */
  public focusNode(node: CascaderNode<T>, columnIndex: number) {
    this.focusedNode.set(node);
    this.focusedColumn.set(columnIndex);
    this.revealColumn(columnIndex);
  }

  /**
   * Slides the browse window to `columnIndex` and moves roving focus onto its drilled node - a
   * breadcrumb activation. The window is anchored AT the column (not minimally revealed), so
   * every crumb maps to a distinct view and stays clickable however the window was slid before.
   */
  public showColumn(columnIndex: number) {
    this.columnWindowStart.set(columnIndex);

    const node = this.openPath()[columnIndex] ?? this.columns()[columnIndex]?.nodes[0];

    if (node) {
      this.focusNode(node, columnIndex);
    }

    this.focusPulse.update((pulse) => pulse + 1);
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

    // Space activates the focused node (the native button's own default) - it must never be
    // taken for a printable character, or the node stops being activatable by keyboard
    if (event.key.length !== 1 || event.key === ' ') {
      return;
    }

    const search = this.registeredSearch();

    if (search) {
      event.preventDefault();
      search.appendCharacter(event.key);

      return;
    }

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

  /** Collapses the deepest column and moves focus back to its parent - the sheet's back-nav. */
  public goBack() {
    const path = this.openPath();
    const parent = path.at(-1);

    if (!parent) {
      return;
    }

    this.navigationDirection.set('backward');
    this.titleAnimation.set(path.length === 1 ? 'fade' : 'slide');
    this.openPath.update((current) => current.slice(0, -1));
    this.truncateColumns(this.openPath().length + 1);
    this.focusNode(parent, this.openPath().length);
    this.pullFocusAfterSettle();
  }

  /** @internal Reloads a column that errored - wired to the panel's retry control. */
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

  /** Clears the flat-search query (and with it the result list - the columns return). */
  public clearSearch() {
    const search = this.registeredSearch();

    if (search) {
      search.clear();
    } else {
      this.searchQuery.set('');
    }

    this.focusedSearchIndex.set(-1);
  }

  /** Re-runs a failed search with the current query - wired to the panel's retry control. */
  public retrySearch() {
    this.searchRetry.update((count) => count + 1);
  }

  /** Activates a search result: commits selectable nodes, jumps the browse state to branch-only matches. */
  public activateSearchResult(path: CascaderNode<T>[]) {
    const node = path[path.length - 1];

    if (!node || node.disabled || this.disabled() || this.readonly()) {
      return;
    }

    if (canHaveChildren(node) && this.selectableLevels() !== CASCADER_SELECTABLE_LEVELS.ANY) {
      this.browseToPath(path);
      this.clearSearch();

      return;
    }

    if (this.multiple()) {
      this.toggleValue(path);

      return;
    }

    this.path.set([...path]);
    this.value.set(node.value);
    this.mixed.set(false);
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

        if (index === this.searchState().results.length - 1 && search) {
          this.focusedSearchIndex.set(-1);
          search.focus();

          return;
        }

        this.focusSearchOption(index + 1);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();

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

    if (event.key.length === 1 && search) {
      event.preventDefault();
      this.focusedSearchIndex.set(-1);
      search.appendCharacter(event.key);
    }
  }

  // Disabled children are skipped - they can't be toggled, so requiring them would lock the branch
  // out of the full state. `visited` breaks recursion on a (malformed) cyclic source.
  private isFullySelected(node: CascaderNode<T>, visited: CascaderNode<T>[]): boolean {
    const compareWith = this.compareWith();

    if (this.values().some((value) => compareWith(value, node.value))) {
      return true;
    }

    if (!canHaveChildren(node) || visited.some((seen) => compareWith(seen.value, node.value))) {
      return false;
    }

    const children = this.knownChildren().find((entry) =>
      nodesEqual({ a: entry.parent, b: node, compareWith }),
    )?.children;
    const selectable = children?.filter((child) => !child.disabled) ?? [];

    return selectable.length > 0 && selectable.every((child) => this.isFullySelected(child, [...visited, node]));
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
    const attempt = (remaining: number) => {
      // the panel was closed/unmounted while the column was loading - stop, or we'd pull focus
      // into a node that is animating away
      if (!this.isMounted()) {
        return;
      }

      const nodes = this.columns()[columnIndex]?.nodes ?? [];

      if (nodes[0]) {
        this.focusNode(nodes[0], columnIndex);
        this.pullFocusAfterSettle();

        return;
      }

      if (remaining > 0) {
        requestAnimationFrame(() => attempt(remaining - 1));
      }
    };

    attempt(20);
  }

  /**
   * The sheet re-creates the active column on a drill or back navigation, which removes the node
   * that holds DOM focus; the pulse makes the new node take it once it has mounted.
   */
  private pullFocusAfterSettle() {
    nextFrame(() => {
      if (this.isMounted()) {
        this.focusPulse.update((pulse) => pulse + 1);
      }
    });
  }

  private browseToPath(path: CascaderNode<T>[]) {
    this.cancelLoads();
    this.openPath.set([...path]);
    this.columns.set([]);
    this.navigationDirection.set(null);
    this.focusedNode.set(null);

    this.loadColumn(0, null);
    path.forEach((node, index) => this.loadColumn(index + 1, node));

    this.columnWindowStart.set(path.length);
    this.focusFirstOfColumn(path.length);
  }

  private drillInto(node: CascaderNode<T>, columnIndex: number) {
    // already expanded here - nothing to reload, but re-activating a branch whose children sit
    // beyond the window edge (after a breadcrumb slid it back) must still bring them into view
    if (this.isExpanded(node, columnIndex)) {
      this.revealColumn(columnIndex + 1);

      return;
    }

    this.navigationDirection.set('forward');
    this.titleAnimation.set(columnIndex === 0 ? 'fade' : 'slide');
    this.openPath.update((path) => [...path.slice(0, columnIndex), node]);
    this.truncateColumns(columnIndex + 1);
    this.loadColumn(columnIndex + 1, node);
    this.revealColumn(columnIndex + 1);
    this.focusFirstOfColumn(columnIndex + 1);
  }

  private revealColumn(columnIndex: number) {
    const start = this.visibleColumnStart();
    const end = start + this.maxVisibleColumns() - 1;

    if (columnIndex < start) {
      this.columnWindowStart.set(columnIndex);
    } else if (columnIndex > end) {
      this.columnWindowStart.set(columnIndex - this.maxVisibleColumns() + 1);
    }
  }

  private commit(options: { node: CascaderNode<T>; columnIndex: number; close: boolean }) {
    const { node, columnIndex, close } = options;
    const chain = [...this.openPath().slice(0, columnIndex), node];

    this.path.set(chain);
    this.value.set(node.value);
    this.mixed.set(false);

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
          { element: this.hostElement },
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
            this.rememberChildren(parent, nodes);

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

  private rememberChildren(parent: CascaderNode<T> | null, children: CascaderNode<T>[]) {
    const compareWith = this.compareWith();

    this.knownChildren.update((entries) => [
      ...entries.filter((entry) =>
        parent === null ? entry.parent !== null : !nodesEqual({ a: entry.parent, b: parent, compareWith }),
      ),
      { parent, children },
    ]);
  }

  private setColumn(columnIndex: number, state: CascaderColumnState<T>) {
    this.columns.update((columns) => {
      const next = [...columns];

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

  private handlePanelKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const search = this.registeredSearch();

    if (search && this.searchQuery()) {
      this.clearSearch();
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
    this.searchQuery.set('');
    this.focusedSearchIndex.set(-1);
    this.navigationDirection.set(null);

    // seed focus to the committed root before loading - the guard in the root load skips its
    // own seed
    const committed = this.mixed() ? [] : this.multiple() ? (this.selectedPaths()[0] ?? []) : this.path();

    this.focusedNode.set(committed[0] ?? null);

    this.loadColumn(0, null);

    committed.forEach((node, index) => {
      if (canHaveChildren(node)) {
        this.openPath.update((path) => [...path, node]);
        this.loadColumn(index + 1, node);
      }
    });

    this.columnWindowStart.set(this.openPath().length);
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

    if (hitsInteractiveElement(target, frame)) {
      return;
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
