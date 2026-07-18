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
import { EMPTY, Subscription, catchError, fromEvent, switchMap, take, tap } from 'rxjs';
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
import { CascaderColumnState } from './cascader.tokens';
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

@Directive({
  selector: '[etCascader]',
  exportAs: 'etCascader',
  host: {
    '[attr.data-cascader-open]': 'open() || null',
  },
})
export class CascaderDirective<T = unknown> implements FormValueControl<T | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private bottomSheetStrategy = injectBottomSheetStrategy();

  public value = model<T | null>(null);
  public touched = model(false);
  public open = model(false);
  public disabled = input(false);
  public readonly = input(false);
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

  /** Turns a `loadChildren` failure into the per-column error text. */
  public toErrorMessage = input<(error: unknown) => string>(() => 'Something went wrong');

  /** Whether the overlay panel mirrors the anchor's width (off — columns size themselves). */
  public mirrorPanelWidth = input(false);

  public opened = output<void>();
  public closed = output<void>();

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value() !== null && this.value() !== undefined);

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
  /** @internal The mounted tree panel's element id — the trigger points `aria-controls` at it. */
  public panelId = signal<string | null>(null);

  /** The columns currently shown — column 0 is the root, each subsequent one a drilled level. */
  public columns = signal<CascaderColumnState<T>[]>([]);

  /** The chain of nodes drilled into — `openPath[i]` is the parent of column `i + 1`. */
  private openPath = signal<CascaderNode<T>[]>([]);

  /** The committed selection chain from root to the chosen node (for the breadcrumb trigger). */
  public path = signal<CascaderNode<T>[]>([]);
  public pathValue = computed(() => this.path().map((node) => node.value));

  /** The label of the current value, or `null` (show the placeholder). */
  public displayPath = computed(() => this.path().map((node) => node.label));
  public displayValue = computed(() => {
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
        closeOnEscape: true,
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
        if (this.overlayRef()) {
          this.focusPulse.update((pulse) => pulse + 1);
        }
      });
    },
    onMounted: () => this.opened.emit(),
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
    // reopened panel starts at the root instead of a stale branch
    effect(() => {
      const value = this.value();

      untracked(() => {
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
          if (value === null || value === undefined) {
            return EMPTY;
          }

          const compareWith = this.compareWith();
          const currentPath = this.path();
          const last = currentPath[currentPath.length - 1];

          // the committed path already ends at this value — nothing to resolve
          if (last && compareWith(last.value, value)) {
            return EMPTY;
          }

          const resolvePath = this.dataSource()?.resolvePath;

          if (!resolvePath) {
            return EMPTY;
          }

          return toPathObservable(resolvePath(value)).pipe(
            tap((resolved) => {
              // a later value change / clear superseded this (async) resolve — drop it
              const currentValue = this.value();

              if (currentValue === null || currentValue === undefined || !compareWith(currentValue, value)) {
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

  /** Whether a node is on the committed selection chain. */
  public isSelected(node: CascaderNode<T>) {
    return this.path().some((selected) => this.compareWith()(selected.value, node.value));
  }

  /** Whether a node is expanded (its children fill the next column). */
  public isExpanded(node: CascaderNode<T>, columnIndex: number) {
    return nodesEqual({ a: this.openPath()[columnIndex] ?? null, b: node, compareWith: this.compareWith() });
  }

  /** Activates a node from a pointer/keyboard interaction: drills into branches, commits leaves. */
  public activateNode(node: CascaderNode<T>, columnIndex: number) {
    if (this.disabled() || this.readonly() || node.disabled) {
      return;
    }

    this.focusNode(node, columnIndex);

    if (canHaveChildren(node)) {
      this.drillInto(node, columnIndex);

      if (this.selectableLevels() === CASCADER_SELECTABLE_LEVELS.ANY) {
        this.commit({ node, columnIndex, close: false });
      }

      return;
    }

    this.commit({ node, columnIndex, close: true });
  }

  /** Clears the committed value (and its breadcrumb). */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(null);
    this.path.set([]);
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

    // type-to-search the focused column by node label (mirrors the select's typeahead)
    if (event.key.length === 1) {
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

  private resetBrowseState() {
    this.cancelLoads();
    this.openPath.set([]);
    this.columns.set([]);
    this.focusedColumn.set(0);
    // no slide animation for the columns present when the panel first opens
    this.navigationDirection.set(null);

    // seed focus to the committed root before loading — a set value re-opens where it left off,
    // and the guard in the root load skips its own seed. An empty value leaves focus null so the
    // root load seeds it to the first node instead.
    const committed = this.path();

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
