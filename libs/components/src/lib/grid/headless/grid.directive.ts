import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  output,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectPrefersReducedMotion, RuntimeError, signalHostElementDimensions, randomId } from '@ethlete/core';
import { filter, switchMap, tap, timer } from 'rxjs';
import { GRID_ERROR_CODES } from '../grid-errors';
import { injectGridConfig } from './grid-config';
import { GRID_TOKEN } from './grid.tokens';
import {
  GridBreakpointConfig,
  GridBreakpointName,
  GridComponentRegistration,
  GridItemConfig,
  GridItemConstraints,
  GridItemPosition,
  GridLayoutEntry,
  GridMutationOptions,
  GridSerializedState,
} from './grid.types';
import {
  autoPlace,
  clampPosition,
  compactLayout,
  computeGeometry,
  computeGridHeight,
  DEFAULT_BREAKPOINTS,
  positionsEqual,
  resolveBreakpoint,
  resolveCollisions,
  rowsToPixelHeight,
  serializeGridLayout,
} from './internals';

export type ResizeItemOptions = {
  id: string;
  newColSpan: number;
  newRowSpan: number;
  newCol?: number;
  newRow?: number;
};

export type GridDragState = {
  itemId: string;
  originPosition: GridItemPosition;
  targetPosition: GridItemPosition;
};

export const GRID_DEBUG_STORAGE_KEY = 'et-grid-debug';

let cachedGridDebug: boolean | null = null;

export const isGridDebugEnabled = () => {
  if (cachedGridDebug === null) {
    try {
      cachedGridDebug = globalThis.localStorage?.getItem(GRID_DEBUG_STORAGE_KEY) === 'true';
    } catch {
      cachedGridDebug = false;
    }
  }

  return cachedGridDebug;
};

export const gridDebug = (...args: unknown[]) => {
  if (!isGridDebugEnabled()) return;

  const timestamp = (globalThis.performance?.now() ?? 0).toFixed(1);
  console.log(`\x1B[36m[et-grid ${timestamp}ms]\x1B[m`, ...args);
};

const layoutsEqual = (a: Record<string, GridItemPosition>, b: Record<string, GridItemPosition>) => {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;

  return aKeys.every((k) => {
    const ap = a[k];
    const bp = b[k];
    return ap !== undefined && bp !== undefined && positionsEqual(ap, bp);
  });
};

const DEFAULT_CONSTRAINTS: GridItemConstraints = {
  minColSpan: 1,
  maxColSpan: 12,
  minRowSpan: 1,
  maxRowSpan: 24,
};

/**
 * Column spans are declared once per item but the column count is per breakpoint, so a
 * `minColSpan: 2` reaches a one-column breakpoint as a span wider than the grid. Both bounds are
 * capped here, at the single point every consumer of a constraint reads, rather than at each of the
 * places that place, resize or clamp a position.
 */
const fitConstraintsToColumns = (constraints: GridItemConstraints, columns: number): GridItemConstraints => {
  const maxColSpan = Math.min(constraints.maxColSpan, columns);

  return { ...constraints, minColSpan: Math.min(constraints.minColSpan, maxColSpan), maxColSpan };
};

/**
 * Three layers, narrowest last: the defaults, the registration for the item's `type`, then whatever
 * the item's own `et-grid-item` inputs set. The item layer is a partial - the inputs are unset unless
 * a consumer wrote them - so refining one bound of a registered type does not silently reset the
 * other three to an input default.
 */
const resolveItemConstraints = (
  id: string,
  context: {
    itemConfigs: GridItemConfig[];
    registrations: GridComponentRegistration[];
    constraintsRegistry: ReadonlyMap<string, Partial<GridItemConstraints>>;
    columns: number;
  },
): GridItemConstraints => {
  const item = context.itemConfigs.find((i) => i.id === id);
  const registration = item ? context.registrations.find((r) => r.type === item.type) : undefined;

  return fitConstraintsToColumns(
    {
      ...DEFAULT_CONSTRAINTS,
      ...registration?.constraints,
      ...context.constraintsRegistry.get(id),
    },
    context.columns,
  );
};

const LEAVE_ANIMATION_MS = 200;
const CONTAINER_RESIZE_SETTLE_MS = 150;

@Directive({
  selector: '[etGrid]',
  exportAs: 'etGrid',
  providers: [{ provide: GRID_TOKEN, useExisting: GridDirective }],
  host: {
    class: 'et-grid',
    '[class.et-grid--readonly]': 'readOnly()',
    '[style.height.px]': 'hostHeight()',
    '[style.transition]': 'containerTransition()',
    '[style.--et-grid-gap.px]': 'gap()',
    '[style.--et-grid-anim-duration]': 'isResizeActive() ? "160ms" : null',
  },
})
export class GridDirective<TData = unknown> {
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private gridConfig = injectGridConfig();
  private reducedMotion = injectPrefersReducedMotion();

  public breakpoints = input<GridBreakpointConfig[]>(DEFAULT_BREAKPOINTS);
  public rowHeight = input(100, { transform: numberAttribute });
  public gap = input(16, { transform: numberAttribute });
  /**
   * The items to render. Despite the name this is a live input, not a one-shot seed: every change is
   * reconciled against what the grid holds - added ids are placed, missing ids are removed, an empty
   * array clears the grid, and the same ids with different positions restore those positions. A host
   * can therefore keep feeding its own signal in, including a saved snapshot after cancelled edits,
   * without rebuilding the grid.
   */
  public initialItems = input<GridItemConfig<string, TData>[]>([]);
  public readOnly = input(false, { transform: booleanAttribute });

  /**
   * Emitted after the layout changed on this side: a drag, a resize, a keyboard move, `addItem()` or
   * `removeItem()`. Reconciling `initialItems` does not emit - what the host passed in cannot be news
   * to it - so this output can be read as "the user has unsaved changes".
   */
  public layoutChange = output<GridSerializedState<TData>>();

  /**
   * @internal
   * The items input of the `et-grid` around this directive, handed over rather than bound: a host
   * directive cannot be parameterized by its component's generic, so the component declares the typed
   * input and points this at it.
   */
  public hostItems = signal<Signal<GridItemConfig<string, TData>[]> | null>(null);

  private incomingItems = computed(() => this.hostItems()?.() ?? this.initialItems());

  public registrations = computed(() => this.gridConfig.registrations);

  private dimensions = signalHostElementDimensions();
  private itemConfigs = signal<GridItemConfig<string, TData>[]>([]);
  private layoutOverrides = signal<Record<GridBreakpointName, GridLayoutEntry[]>>({});
  public dragState = signal<GridDragState | null>(null);

  // A signal, not a plain Map: an item registers its constraints after the first layout pass, and
  // everything derived from them - the live drag layout, the resize edges - has to see that arrive.
  private constraintsRegistry = signal<ReadonlyMap<string, Partial<GridItemConstraints>>>(new Map());

  private resizeBaseLayout = signal<GridLayoutEntry[] | null>(null);
  private pendingResize: { id: string; position: GridItemPosition } | null = null;
  private lastResizeTarget: GridItemPosition | null = null;

  public leavingIds = signal<ReadonlySet<string>>(new Set<string>());

  public isResizeActive = signal(false);
  private animationsReady = signal(false);
  private isContainerResizing = signal(false);

  public containerWidth = computed(() => this.dimensions().client?.width ?? 0);

  public isReady = computed(() => this.containerWidth() > 0);

  public animationsEnabled = computed(
    () => this.animationsReady() && !this.isContainerResizing() && !this.reducedMotion(),
  );

  public activeBreakpoint = computed(() => {
    const width = this.containerWidth();
    return resolveBreakpoint(this.breakpoints(), width);
  });

  public activeColumns = computed(() => {
    const bp = this.breakpoints().find((b) => b.name === this.activeBreakpoint());
    return bp?.columns ?? 12;
  });

  private paddings = computed(() => {
    this.dimensions();

    if (typeof getComputedStyle === 'undefined') {
      return { left: 0, top: 0, right: 0, bottom: 0 };
    }

    const style = getComputedStyle(this.elementRef.nativeElement);

    return {
      left: parseFloat(style.paddingLeft) || 0,
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
    };
  });

  public geometry = computed(() => {
    const padding = this.paddings();

    return computeGeometry({
      contentWidth: Math.max(0, this.containerWidth() - padding.left - padding.right),
      columns: this.activeColumns(),
      gap: this.gap(),
      rowHeight: this.rowHeight(),
      originX: padding.left,
      originY: padding.top,
    });
  });

  public items = computed(() => this.itemConfigs());

  public baseLayout = computed((): GridLayoutEntry[] => {
    const breakpoint = this.activeBreakpoint();
    const overrides = this.layoutOverrides();
    const items = this.itemConfigs();

    if (overrides[breakpoint]) {
      return overrides[breakpoint];
    }

    return items.map((item) => ({
      id: item.id,
      position: item.layout[breakpoint] ?? { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    }));
  });

  public layout = computed((): GridLayoutEntry[] => {
    const base = this.baseLayout();
    const drag = this.dragState();

    if (!drag) return base;

    const columns = this.activeColumns();
    const clamped = clampPosition({
      position: drag.targetPosition,
      constraints: resolveItemConstraints(drag.itemId, {
        itemConfigs: this.itemConfigs(),
        registrations: this.gridConfig.registrations,
        constraintsRegistry: this.constraintsRegistry(),
        columns,
      }),
      columns,
    });

    const withTarget = base.map((e) => (e.id === drag.itemId ? { ...e, position: clamped } : e));

    return resolveCollisions({
      entries: withTarget,
      movedId: drag.itemId,
      columns,
      originPosition: drag.originPosition,
    });
  });

  public containerHeightPx = computed(() => {
    const padding = this.paddings();
    return rowsToPixelHeight(computeGridHeight(this.layout()), this.geometry()) + padding.top + padding.bottom;
  });

  protected hostHeight = computed(() => (this.isReady() ? this.containerHeightPx() : null));

  protected containerTransition = computed(() =>
    this.animationsEnabled() ? 'height var(--et-grid-anim-duration, 250ms) cubic-bezier(0.2, 0, 0, 1)' : 'none',
  );

  public ghostPosition = computed((): GridItemPosition | null => {
    const drag = this.dragState();

    if (!drag) return null;

    const layout = this.layout();
    const entry = layout.find((e) => e.id === drag.itemId);
    return entry?.position ?? null;
  });

  constructor() {
    // Enable animations one frame after the first measurement so initial placement
    // is never animated, then suppress them while the container width is in flux.
    effect(() => {
      if (!this.isReady()) return;

      untracked(() => {
        if (this.animationsReady()) return;

        afterNextRender(() => this.animationsReady.set(true), { injector: this.injector });
      });
    });

    toObservable(this.containerWidth)
      .pipe(
        filter(() => this.animationsReady()),
        tap(() => this.isContainerResizing.set(true)),
        switchMap(() => timer(CONTAINER_RESIZE_SETTLE_MS)),
        tap(() => this.isContainerResizing.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const initial = this.incomingItems();
      untracked(() => {
        if (initial.length === 0 && this.itemConfigs().length === 0) return;

        if (ngDevMode) {
          this.assertValidItemConfigs(initial);
        }

        const current = this.itemConfigs();

        if (current.length === 0) {
          this.itemConfigs.set(initial);

          return;
        }

        const currentById = new Map(current.map((c) => [c.id, c]));
        const initialIds = new Set(initial.map((i) => i.id));

        const newItems = initial.filter((item) => !currentById.has(item.id));
        const removedIds = current.filter((c) => !initialIds.has(c.id)).map((c) => c.id);

        // Pure layout update - same item set but positions changed (e.g. the host
        // reset its signal to a saved snapshot after the user cancelled edits).
        // A structural add/remove takes precedence and is handled below.
        if (newItems.length === 0 && removedIds.length === 0) {
          const anyLayoutChanged = initial.some((incoming) => {
            const existing = currentById.get(incoming.id);
            return existing && !layoutsEqual(existing.layout, incoming.layout);
          });

          if (anyLayoutChanged) {
            // Restore itemConfigs from the incoming snapshot.
            this.itemConfigs.set(initial);

            // Rebuild layoutOverrides for every breakpoint that has already been
            // visited so the grid renders the restored positions immediately without
            // waiting for a breakpoint switch.
            const visitedBps = Object.keys(this.layoutOverrides());
            if (visitedBps.length > 0) {
              const columnsByBp = new Map(this.breakpoints().map((bp) => [bp.name, bp.columns]));
              const restored: Record<string, GridLayoutEntry[]> = {};

              for (const bp of visitedBps) {
                restored[bp] = this.entriesForBreakpoint({
                  items: initial,
                  breakpoint: bp,
                  columns: columnsByBp.get(bp) ?? this.activeColumns(),
                });
              }

              this.layoutOverrides.set(restored);
            }

            return;
          }

          // Same items in the same places, but the host refreshed their `data` - a re-fetch landing
          // new widget contents, say. Copy `data` alone: an existing config's `layout` holds what
          // `moveItem` last wrote, which is ahead of the host's snapshot, so setting `initial`
          // wholesale here would revert the moves.
          const changedData = initial.filter((incoming) => currentById.get(incoming.id)?.data !== incoming.data);

          if (changedData.length > 0) {
            const dataById = new Map(changedData.map((item) => [item.id, item.data]));

            this.itemConfigs.update((items) =>
              items.map((item) => {
                const incoming = dataById.get(item.id);

                return dataById.has(item.id) ? { ...item, data: incoming as TData } : item;
              }),
            );
          }

          return;
        }

        // Silent: the host is the source of these items, so echoing them back as a `layoutChange`
        // would read as a user edit to anything treating that output as a dirty flag.
        for (const item of newItems) {
          this.placeItem(item, { silent: true });
        }

        for (const id of removedIds) {
          this.removeItem(id, { silent: true });
        }
      });
    });

    effect(() => {
      const breakpoint = this.activeBreakpoint();
      const items = this.itemConfigs();

      if (items.length === 0) return;

      untracked(() => {
        const overrides = this.layoutOverrides();
        const existing = overrides[breakpoint];
        const columns = this.activeColumns();

        if (!existing || existing.length !== items.length) {
          const entries = this.entriesForBreakpoint({
            items,
            breakpoint,
            columns,
            existing: existing ? new Map(existing.map((e) => [e.id, e])) : null,
          });

          const compacted = compactLayout({ entries, columns });

          this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: compacted }));
        } else {
          // Cap items that overflow the column boundary after a breakpoint change.
          // Min span is intentionally NOT enforced here: newly-added items are placed
          // with 1×1 defaults before their GridItemDirective registers real constraints,
          // and registerConstraints() corrects the size on first registration.
          // Enforcing min here would resize those items again on the next addItem call
          // and cause them to overlap their neighbours.
          const clamped = existing.map((entry) => {
            const constraints = this.getConstraints(entry.id);
            const pos = entry.position;
            const colSpan = Math.min(pos.colSpan, constraints.maxColSpan, columns);
            const col = Math.min(pos.col, columns - colSpan);
            const rowSpan = Math.min(pos.rowSpan, constraints.maxRowSpan);

            return { ...entry, position: { col, row: pos.row, colSpan, rowSpan } };
          });

          const hasChanged = clamped.some((e, i) => {
            const orig = existing[i];

            return orig && (e.position.col !== orig.position.col || e.position.colSpan !== orig.position.colSpan);
          });

          if (hasChanged) {
            const compacted = compactLayout({ entries: clamped, columns });
            this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: compacted }));
          }
        }
      });
    });
  }

  public getContainerOrigin(): { left: number; top: number } {
    const el = this.elementRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return { left: rect.left + el.clientLeft, top: rect.top + el.clientTop };
  }

  public registerConstraints(id: string, constraints: Partial<GridItemConstraints>) {
    // Every signal read here is wrapped in untracked() to prevent this method from inadvertently
    // becoming a dependency of the caller's reactive context (e.g. GridItemDirective's registration
    // effect), which would cause the writes below to re-trigger that effect in a loop.
    untracked(() => {
      const isFirstRegistration = !this.constraintsRegistry().has(id);
      this.constraintsRegistry.update((prev) => new Map(prev).set(id, constraints));

      if (!isFirstRegistration) return;

      // On first registration the item may have been auto-placed with 1×1 defaults
      // (because addItem runs before the GridItemDirective initialises). If so,
      // re-place it now at the correct minimum size.
      const breakpoint = this.activeBreakpoint();
      const existing = this.layoutOverrides()[breakpoint];
      if (!existing) return;

      const entry = existing.find((e) => e.id === id);
      if (!entry) return;

      const cols = this.activeColumns();
      const effective = this.getConstraintsForColumns(id, cols);
      const pos = entry.position;
      if (pos.colSpan >= effective.minColSpan && pos.rowSpan >= effective.minRowSpan) return;

      const others = existing.filter((e) => e.id !== id);
      const newPosition = autoPlace({
        entries: others,
        colSpan: Math.max(pos.colSpan, effective.minColSpan),
        rowSpan: Math.max(pos.rowSpan, effective.minRowSpan),
        columns: cols,
      });

      const updated = existing.map((e) => (e.id === id ? { ...e, position: newPosition } : e));
      const compacted = compactLayout({ entries: updated, columns: cols });
      this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: compacted }));
    });
  }

  public unregisterConstraints(id: string) {
    untracked(() => {
      if (!this.constraintsRegistry().has(id)) return;

      this.constraintsRegistry.update((prev) => {
        const next = new Map(prev);
        next.delete(id);

        return next;
      });
    });
  }

  /** The item's constraints as they apply at the active breakpoint - column spans already capped to it. */
  public getConstraints(id: string): GridItemConstraints {
    return this.getConstraintsForColumns(id, this.activeColumns());
  }

  /** The same, for a breakpoint other than the active one (placement writes every breakpoint at once). */
  public getConstraintsForColumns(id: string, columns: number): GridItemConstraints {
    return resolveItemConstraints(id, {
      itemConfigs: this.itemConfigs(),
      registrations: this.gridConfig.registrations,
      constraintsRegistry: this.constraintsRegistry(),
      columns,
    });
  }

  public beginDrag(itemId: string): GridItemPosition | null {
    const entry = this.baseLayout().find((e) => e.id === itemId);

    if (!entry) return null;

    this.dragState.set({
      itemId,
      originPosition: entry.position,
      targetPosition: entry.position,
    });

    return entry.position;
  }

  public updateDragTarget(cell: { col: number; row: number }) {
    const drag = this.dragState();

    if (!drag) return;

    const targetPosition: GridItemPosition = { ...drag.originPosition, col: cell.col, row: cell.row };

    // Gate here (not in the gesture directive) so a no-op target never re-runs
    // collision resolution or touches any item's slot.
    if (positionsEqual(drag.targetPosition, targetPosition)) return;

    this.dragState.set({ ...drag, targetPosition });
  }

  public commitDrag(): GridItemPosition | null {
    const drag = this.dragState();

    if (!drag) return null;

    // Commit the full resolved layout (includes swaps and collision resolution)
    const resolvedLayout = this.layout();
    this.updateLayoutForCurrentBreakpoint(resolvedLayout);

    const breakpoint = this.activeBreakpoint();

    this.itemConfigs.update((items) =>
      items.map((item) => {
        const entry = resolvedLayout.find((e) => e.id === item.id);

        if (!entry) return item;

        return { ...item, layout: { ...item.layout, [breakpoint]: entry.position } };
      }),
    );

    this.dragState.set(null);
    this.emitLayoutChange();

    return resolvedLayout.find((e) => e.id === drag.itemId)?.position ?? null;
  }

  public cancelDrag() {
    this.dragState.set(null);
  }

  public beginResize(itemId: string): GridItemPosition | null {
    const base = this.baseLayout();
    const entry = base.find((e) => e.id === itemId);

    if (!entry) return null;

    this.resizeBaseLayout.set(base);
    this.pendingResize = null;
    this.lastResizeTarget = null;
    this.isResizeActive.set(true);

    return entry.position;
  }

  public updateResize(itemId: string, target: GridItemPosition) {
    const base = this.resizeBaseLayout();

    if (!base) return;

    if (this.lastResizeTarget && positionsEqual(this.lastResizeTarget, target)) return;
    this.lastResizeTarget = target;

    const entry = base.find((e) => e.id === itemId);

    if (!entry) return;

    const columns = this.activeColumns();
    const clamped = clampPosition({ position: target, constraints: this.getConstraints(itemId), columns });

    // Try to shrink horizontal neighbors before pushing them down
    const currentLayout = base.map((e) => (e.id === itemId ? { ...e, position: clamped } : e));

    const withShrunk = this.shrinkNeighbors({
      layout: currentLayout,
      resizedId: itemId,
      resizedPos: clamped,
      originalPos: entry.position,
      columns,
    });

    const rowFloors = new Map(base.map((e) => [e.id, e.position.row]));
    rowFloors.set(itemId, clamped.row);

    const resolved = resolveCollisions({ entries: withShrunk, movedId: itemId, columns, rowFloors });

    this.updateLayoutForCurrentBreakpoint(resolved);

    const resolvedEntry = resolved.find((e) => e.id === itemId);
    this.pendingResize = { id: itemId, position: resolvedEntry?.position ?? clamped };
  }

  public commitResize(): GridItemPosition | null {
    const pending = this.pendingResize;

    this.resizeBaseLayout.set(null);
    this.pendingResize = null;
    this.lastResizeTarget = null;
    this.isResizeActive.set(false);

    if (!pending) return null;

    // Run the upward compaction that was held back during the gesture, so freed-up
    // space is reclaimed only once the pointer is released.
    const compacted = compactLayout({ entries: this.baseLayout(), columns: this.activeColumns() });
    this.updateLayoutForCurrentBreakpoint(compacted);

    const finalPosition = compacted.find((e) => e.id === pending.id)?.position ?? pending.position;

    this.updateItemLayout(pending.id, finalPosition);
    this.emitLayoutChange();

    return finalPosition;
  }

  public cancelResize() {
    const base = this.resizeBaseLayout();

    this.resizeBaseLayout.set(null);
    this.pendingResize = null;
    this.lastResizeTarget = null;
    this.isResizeActive.set(false);

    if (base) {
      this.updateLayoutForCurrentBreakpoint(base);
    }
  }

  /** One-shot resize (keyboard / programmatic): begin + update + commit in a single call. */
  public resizeItem(options: ResizeItemOptions) {
    const start = this.beginResize(options.id);

    if (!start) return;

    this.updateResize(options.id, {
      col: options.newCol ?? start.col,
      row: options.newRow ?? start.row,
      colSpan: options.newColSpan,
      rowSpan: options.newRowSpan,
    });
    this.commitResize();
  }

  public addItem(type: string, data: TData) {
    const id = randomId();

    const config: GridItemConfig<string, TData> = {
      id,
      type,
      data,
      layout: {},
    };

    this.placeItem(config);
  }

  public removeItem(id: string, options?: GridMutationOptions) {
    if (this.leavingIds().has(id)) return;
    if (!this.itemConfigs().some((i) => i.id === id)) return;

    if (!this.animationsEnabled()) {
      this.finalizeRemove(id, options);

      return;
    }

    // Mark the item as leaving - its directive plays the scale/opacity-out transition -
    // then actually remove it once the animation has finished. Neighbours retarget
    // automatically when the layout compacts.
    this.leavingIds.update((ids) => new Set(ids).add(id));

    timer(LEAVE_ANIMATION_MS)
      .pipe(
        tap(() => {
          this.leavingIds.update((ids) => {
            const next = new Set(ids);
            next.delete(id);
            return next;
          });
          this.finalizeRemove(id, options);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public moveItem(id: string, newPosition: GridItemPosition) {
    const columns = this.activeColumns();
    const item = this.itemConfigs().find((i) => i.id === id);

    if (!item) return;

    const clamped = clampPosition({ position: newPosition, constraints: this.getConstraints(id), columns });
    const originPosition = this.baseLayout().find((e) => e.id === id)?.position;
    const currentLayout = this.baseLayout().map((e) => (e.id === id ? { ...e, position: clamped } : e));

    // originPosition enables the swap/escape-upward heuristics - keyboard moves (Ctrl+Arrow)
    // should displace neighbours exactly like the equivalent drag.
    const resolved = resolveCollisions({ entries: currentLayout, movedId: id, columns, originPosition });
    this.updateLayoutForCurrentBreakpoint(resolved);
    this.updateItemLayout(id, clamped);
    this.emitLayoutChange();
  }

  public getSerializedState(): GridSerializedState<TData> {
    const overrides = this.layoutOverrides();

    // layoutOverrides is the authoritative source for any breakpoint that has been visited.
    // itemConfigs.layout[bp] lags behind for breakpoints that haven't been written back
    // yet (e.g. items pushed by moveItem/resizeItem collision resolution, or items whose
    // non-current-breakpoint positions haven't been visited since the last change).
    const items = this.itemConfigs().map((item) => {
      const layout: Record<string, GridItemPosition> = { ...item.layout };

      for (const [bp, entries] of Object.entries(overrides)) {
        const entry = entries.find((e) => e.id === item.id);
        if (entry) layout[bp] = entry.position;
      }

      return { ...item, layout };
    });

    return serializeGridLayout({
      items,
      breakpoints: this.breakpoints(),
      rowHeight: this.rowHeight(),
    });
  }

  public restoreState(state: GridSerializedState<TData>) {
    if (ngDevMode) {
      this.assertValidItemConfigs(state.items);

      const known = this.breakpoints().map((b) => b.name);
      const unknown = Object.keys(state.columns).filter((bp) => !known.includes(bp));

      if (unknown.length > 0) {
        throw new RuntimeError(
          GRID_ERROR_CODES.INVALID_LAYOUT_STATE,
          `[GridDirective] restoreState received a state with unknown breakpoint(s) ${unknown
            .map((name) => `"${name}"`)
            .join(', ')}. Configured breakpoints are ${known.map((name) => `"${name}"`).join(', ')}.`,
          state,
        );
      }
    }

    const items: GridItemConfig<string, TData>[] = state.items.map((item) => ({
      id: item.id,
      type: item.type,
      data: item.data,
      layout: { ...item.layout },
    }));

    this.itemConfigs.set(items);

    const overrides: Record<GridBreakpointName, GridLayoutEntry[]> = {};

    for (const [bpName, columns] of Object.entries(state.columns)) {
      overrides[bpName] = this.entriesForBreakpoint({ items, breakpoint: bpName, columns });
    }

    this.layoutOverrides.set(overrides);
  }

  /**
   * Dev-mode-only: rejects consumer-provided item configs whose ids are not unique, and warns about
   * layouts that do not line up with the configured breakpoints.
   */
  private assertValidItemConfigs(items: GridItemConfig[]) {
    const seen = new Set<string>();

    for (const item of items) {
      if (seen.has(item.id)) {
        throw new RuntimeError(
          GRID_ERROR_CODES.DUPLICATE_ITEM_ID,
          `[GridDirective] Multiple grid item configs share the id "${item.id}". Item ids must be unique.`,
          items.filter((i) => i.id === item.id),
        );
      }

      seen.add(item.id);
    }

    this.warnAboutUncoveredBreakpoints(items);
  }

  /**
   * A layout key that is not a configured breakpoint is never read, and a breakpoint a *partially*
   * positioned layout omits is auto-placed in item order rather than mirroring the arrangement the
   * other breakpoints spell out - both read as the grid having lost part of the layout. An entirely
   * empty layout is the documented "place this for me" input (`addItem` emits exactly that), so it
   * is not a problem and stays silent.
   */
  private warnAboutUncoveredBreakpoints(items: GridItemConfig[]) {
    const configured = this.breakpoints().map((b) => b.name);
    const quote = (names: string[]) => names.map((name) => `"${name}"`).join(', ');

    for (const item of items) {
      const provided = Object.keys(item.layout);
      const missing = provided.length > 0 ? configured.filter((name) => !provided.includes(name)) : [];
      const unknown = provided.filter((name) => !configured.includes(name));

      const problems = [
        missing.length > 0 ? `has no position for ${quote(missing)}` : null,
        unknown.length > 0 ? `has positions for unknown breakpoint(s) ${quote(unknown)}` : null,
      ].filter((problem) => problem !== null);

      if (problems.length === 0) continue;

      console.warn(
        `[GridDirective] The layout of grid item "${item.id}" ${problems.join(' and ')}. Configured breakpoints are ${quote(configured)}; an omitted one is auto-placed in item order instead of following the positions the layout does carry.`,
        item,
      );
    }
  }

  private finalizeRemove(id: string, options?: GridMutationOptions) {
    this.itemConfigs.update((items) => items.filter((i) => i.id !== id));

    const columns = this.activeColumns();
    const currentLayout = this.baseLayout().filter((e) => e.id !== id);
    const compacted = compactLayout({ entries: currentLayout, columns });

    this.updateLayoutForCurrentBreakpoint(compacted);
    this.compactOtherBreakpoints(id);

    if (!options?.silent) this.emitLayoutChange();
  }

  /**
   * The layout entries of `items` for one breakpoint. An item the breakpoint has no position for is
   * auto-placed against the entries built before it, so a partial layout spreads out instead of
   * stacking every unpositioned item on the grid origin.
   */
  private entriesForBreakpoint(options: {
    items: readonly GridItemConfig<string, TData>[];
    breakpoint: string;
    columns: number;
    existing?: Map<string, GridLayoutEntry> | null;
  }): GridLayoutEntry[] {
    const { items, breakpoint, columns, existing } = options;
    const entries: GridLayoutEntry[] = [];

    for (const item of items) {
      const existingEntry = existing?.get(item.id);

      if (existingEntry) {
        entries.push(existingEntry);
        continue;
      }

      const constraints = this.getConstraintsForColumns(item.id, columns);
      const position =
        item.layout[breakpoint] ??
        autoPlace({
          entries,
          colSpan: constraints.minColSpan,
          rowSpan: constraints.minRowSpan,
          columns,
        });

      entries.push({ id: item.id, position });
    }

    return entries;
  }

  private placeItem(config: GridItemConfig<string, TData>, options?: GridMutationOptions) {
    const activeBp = this.activeBreakpoint();
    const columns = this.activeColumns();
    const currentLayout = this.baseLayout();
    const constraints = this.getConstraints(config.id);
    const allBreakpoints = this.breakpoints();
    const overrides = this.layoutOverrides();
    const existingItems = this.itemConfigs();

    // Start from any layouts already in the config (e.g. when re-adding from API data).
    const layout: Record<string, GridItemPosition> = { ...config.layout };

    // Place on the active breakpoint first so other breakpoints can use it as a reference.
    const position =
      layout[activeBp] ??
      autoPlace({
        entries: currentLayout,
        colSpan: constraints.minColSpan,
        rowSpan: constraints.minRowSpan,
        columns,
      });
    layout[activeBp] = position;

    // Auto-place on every other breakpoint that has no position yet.
    // This ensures the emitted layoutChange always carries all breakpoints so
    // the host's gridItems signal never loses sm/md positions for new items.
    for (const bp of allBreakpoints) {
      if (bp.name === activeBp || layout[bp.name]) continue;

      // Effective layout for this breakpoint: prefer layoutOverrides (already visited),
      // fall back to itemConfigs.layout[bp] (original API positions).
      const bpEntries: GridLayoutEntry[] =
        overrides[bp.name] ??
        this.entriesForBreakpoint({ items: existingItems, breakpoint: bp.name, columns: bp.columns });

      layout[bp.name] = autoPlace({
        entries: bpEntries,
        colSpan: this.getConstraintsForColumns(config.id, bp.columns).minColSpan,
        rowSpan: constraints.minRowSpan,
        columns: bp.columns,
      });
    }

    const itemWithLayout: GridItemConfig<string, TData> = { ...config, layout };

    this.itemConfigs.update((items) => [...items, itemWithLayout]);
    this.updateLayoutForCurrentBreakpoint([...currentLayout, { id: config.id, position }]);

    if (!options?.silent) this.emitLayoutChange();
  }

  private shrinkNeighbors(options: {
    layout: GridLayoutEntry[];
    resizedId: string;
    resizedPos: GridItemPosition;
    originalPos: GridItemPosition;
    columns: number;
  }): GridLayoutEntry[] {
    const { layout, resizedId, resizedPos, originalPos, columns } = options;

    // Compute candidate shrunk positions
    const candidates = layout.map((entry) => {
      if (entry.id === resizedId) return entry;

      const pos = entry.position;

      // Use original row range so items that only entered the overlap zone due to a south/north
      // resize are not treated as horizontal neighbors and incorrectly shrunk.
      const rowOverlap = pos.row < originalPos.row + originalPos.rowSpan && pos.row + pos.rowSpan > originalPos.row;
      const colOverlap = pos.col < resizedPos.col + resizedPos.colSpan && pos.col + pos.colSpan > resizedPos.col;

      if (!rowOverlap || !colOverlap) return entry;

      const minColSpan = this.getConstraints(entry.id).minColSpan;

      const neighborIsRight = pos.col >= resizedPos.col;
      const shrunkPos = { ...pos };

      if (neighborIsRight) {
        const newCol = resizedPos.col + resizedPos.colSpan;
        // Prefer sliding the neighbor right over shrinking it - only shrink if its
        // full colSpan no longer fits within the grid at the new column.
        if (newCol + pos.colSpan <= columns) {
          shrunkPos.col = newCol;
        } else {
          // Compute reduction from the max-slide position, not from the base col.
          // Using the base col would count the already-slid distance as part of the
          // shrink, causing a double-step on the first frame where slide is impossible.
          const maxSlideCol = columns - pos.colSpan;
          const excessCols = newCol - maxSlideCol;
          const newColSpan = Math.max(minColSpan, pos.colSpan - excessCols);
          const clampedCol = Math.min(newCol, columns - newColSpan);
          shrunkPos.col = clampedCol;
          shrunkPos.colSpan = newColSpan;
        }
      } else {
        const maxRight = resizedPos.col;
        // Prefer sliding the neighbor left over shrinking it - only shrink if its
        // full colSpan would go below column 0 at the new position.
        if (maxRight - pos.colSpan >= 0) {
          shrunkPos.col = maxRight - pos.colSpan;
        } else {
          // Compute reduction from the max-slide position (col 0), not from the base col.
          const newColSpan = Math.max(minColSpan, maxRight);
          shrunkPos.col = 0;
          shrunkPos.colSpan = newColSpan;
        }
      }

      return { ...entry, position: shrunkPos };
    });

    // Validate: revert any shrunk item that now collides with another non-resized item
    return candidates.map((entry, idx) => {
      if (entry.id === resizedId) return entry;

      const original = layout[idx] as GridLayoutEntry;

      // Only check items that actually changed
      if (entry.position.col === original.position.col && entry.position.colSpan === original.position.colSpan)
        return entry;

      // If the shrunk position still overlaps the resized item (couldn't be shrunk enough to
      // fit alongside it), revert to the original so resolveCollisions can push it to another row.
      const resizedEntry = candidates.find((c) => c.id === resizedId);
      if (
        resizedEntry &&
        resizedEntry.position.row < entry.position.row + entry.position.rowSpan &&
        resizedEntry.position.row + resizedEntry.position.rowSpan > entry.position.row &&
        resizedEntry.position.col < entry.position.col + entry.position.colSpan &&
        resizedEntry.position.col + resizedEntry.position.colSpan > entry.position.col
      ) {
        return original;
      }

      // Check if the new position collides with any other non-resized item
      const collides = candidates.some(
        (other) =>
          other.id !== entry.id &&
          other.id !== resizedId &&
          other.position.row < entry.position.row + entry.position.rowSpan &&
          other.position.row + other.position.rowSpan > entry.position.row &&
          other.position.col < entry.position.col + entry.position.colSpan &&
          other.position.col + other.position.colSpan > entry.position.col,
      );

      return collides ? original : entry;
    });
  }

  /** Compact all visited breakpoints (layoutOverrides entries) after an item is removed. */
  private compactOtherBreakpoints(removedId: string) {
    const activeBp = this.activeBreakpoint();
    const bpColumns = new Map(this.breakpoints().map((b) => [b.name, b.columns]));

    for (const [bp, entries] of Object.entries(this.layoutOverrides())) {
      if (bp === activeBp) continue;
      const withoutItem = entries.filter((e) => e.id !== removedId);
      const cols = bpColumns.get(bp) ?? 1;
      const compacted = compactLayout({ entries: withoutItem, columns: cols });
      this.layoutOverrides.update((prev) => ({ ...prev, [bp]: compacted }));
    }
  }

  private updateLayoutForCurrentBreakpoint(entries: GridLayoutEntry[]) {
    const breakpoint = this.activeBreakpoint();
    this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: entries }));
  }

  private updateItemLayout(id: string, position: GridItemPosition) {
    const breakpoint = this.activeBreakpoint();

    this.itemConfigs.update((items) =>
      items.map((item) => (item.id === id ? { ...item, layout: { ...item.layout, [breakpoint]: position } } : item)),
    );
  }

  private emitLayoutChange() {
    this.layoutChange.emit(this.getSerializedState());
  }
}
