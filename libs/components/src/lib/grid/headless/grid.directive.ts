import {
  afterNextRender,
  booleanAttribute,
  computed,
  Directive,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { injectRenderer, signalHostElementDimensions } from '@ethlete/core';
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
  GridSerializedState,
} from './grid.types';
import {
  autoPlace,
  clampPosition,
  compactLayout,
  DEFAULT_BREAKPOINTS,
  resolveBreakpoint,
  resolveCollisions,
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

const positionsEqual = (a: GridItemPosition, b: GridItemPosition) =>
  a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;

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

const resolveItemConstraints = (
  id: string,
  context: {
    itemConfigs: GridItemConfig[];
    registrations: GridComponentRegistration[];
    constraintsRegistry: Map<string, GridItemConstraints>;
  },
): GridItemConstraints => {
  const item = context.itemConfigs.find((i) => i.id === id);
  if (item) {
    const registration = context.registrations.find((r) => r.type === item.type);
    if (registration?.constraints) {
      return { ...DEFAULT_CONSTRAINTS, ...registration.constraints };
    }
  }
  return context.constraintsRegistry.get(id) ?? DEFAULT_CONSTRAINTS;
};

@Directive({
  selector: '[etGrid]',
  exportAs: 'etGrid',
  providers: [{ provide: GRID_TOKEN, useExisting: GridDirective }],
  host: {
    class: 'et-grid',
    '[class.et-grid--readonly]': 'readOnly()',
  },
})
export class GridDirective {
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private gridConfig = injectGridConfig();

  public breakpoints = input<GridBreakpointConfig[]>(DEFAULT_BREAKPOINTS);
  public rowHeight = input(100);
  public gap = input(16);
  public initialItems = input<GridItemConfig[]>([]);
  public readOnly = input(false, { transform: booleanAttribute });

  public layoutChange = output<GridSerializedState>();

  public registrations = computed(() => this.gridConfig.registrations);

  private dimensions = signalHostElementDimensions();
  private itemConfigs = signal<GridItemConfig[]>([]);
  private layoutOverrides = signal<Record<GridBreakpointName, GridLayoutEntry[]>>({});
  public dragState = signal<GridDragState | null>(null);

  private constraintsRegistry = new Map<string, GridItemConstraints>();

  private resizeBaseLayout = signal<GridLayoutEntry[] | null>(null);

  private itemElements = new Map<string, HTMLElement>();
  private contentElements = new Map<string, HTMLElement>();
  private ghostElement: HTMLElement | null = null;
  private lastFlipAt = 0;
  private rectSnapshot = new Map<string, DOMRect>();

  public containerWidth = computed(() => this.dimensions().client?.width ?? 0);

  public activeBreakpoint = computed(() => {
    const width = this.containerWidth();
    return resolveBreakpoint(this.breakpoints(), width);
  });

  public activeColumns = computed(() => {
    const bp = this.breakpoints().find((b) => b.name === this.activeBreakpoint());
    return bp?.columns ?? 12;
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
        constraintsRegistry: this.constraintsRegistry,
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

  public ghostPosition = computed((): GridItemPosition | null => {
    const drag = this.dragState();

    if (!drag) return null;

    const layout = this.layout();
    const entry = layout.find((e) => e.id === drag.itemId);
    return entry?.position ?? null;
  });

  constructor() {
    effect(() => {
      const initial = this.initialItems();
      untracked(() => {
        if (initial.length === 0) return;

        const current = this.itemConfigs();

        if (current.length === 0) {
          this.itemConfigs.set(initial);

          return;
        }

        const currentById = new Map(current.map((c) => [c.id, c]));
        const initialIds = new Set(initial.map((i) => i.id));

        const newItems = initial.filter((item) => !currentById.has(item.id));
        const removedIds = current.filter((c) => !initialIds.has(c.id)).map((c) => c.id);

        // Pure layout update — same item set but positions changed (e.g. the host
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
              const restored: Record<string, GridLayoutEntry[]> = {};
              for (const bp of visitedBps) {
                restored[bp] = initial.map((item) => ({
                  id: item.id,
                  position: item.layout[bp] ?? { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
                }));
              }
              this.layoutOverrides.set(restored);
            }
          }

          return;
        }

        for (const item of newItems) {
          this.placeItem(item);
        }

        for (const id of removedIds) {
          this.removeItem(id);
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
          const existingById = existing ? new Map(existing.map((e) => [e.id, e])) : new Map<string, GridLayoutEntry>();
          const entries: GridLayoutEntry[] = [];

          for (const item of items) {
            const existingEntry = existingById.get(item.id);

            if (existingEntry) {
              entries.push(existingEntry);
            } else {
              const constraints = this.getConstraints(item.id);
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
          }

          const compacted = compactLayout(entries, columns);

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
            const compacted = compactLayout(clamped, columns);
            this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: compacted }));
          }
        }
      });
    });
  }

  public registerConstraints(id: string, constraints: GridItemConstraints) {
    const isFirstRegistration = !this.constraintsRegistry.has(id);
    this.constraintsRegistry.set(id, constraints);

    if (!isFirstRegistration) return;

    // On first registration the item may have been auto-placed with 1×1 defaults
    // (because addItem runs before the GridItemDirective initialises). If so,
    // re-place it now at the correct minimum size.
    // All signal reads are wrapped in untracked() to prevent this method from
    // inadvertently becoming a dependency of the caller's reactive context
    // (e.g. GridItemDirective's registration effect), which would cause the
    // layoutOverrides.update() write below to re-trigger that effect in a loop.
    untracked(() => {
      const breakpoint = this.activeBreakpoint();
      const existing = this.layoutOverrides()[breakpoint];
      if (!existing) return;

      const entry = existing.find((e) => e.id === id);
      if (!entry) return;

      const pos = entry.position;
      if (pos.colSpan >= constraints.minColSpan && pos.rowSpan >= constraints.minRowSpan) return;

      const cols = this.activeColumns();
      const others = existing.filter((e) => e.id !== id);
      const newPosition = autoPlace({
        entries: others,
        colSpan: Math.max(pos.colSpan, constraints.minColSpan),
        rowSpan: Math.max(pos.rowSpan, constraints.minRowSpan),
        columns: cols,
      });

      const updated = existing.map((e) => (e.id === id ? { ...e, position: newPosition } : e));
      const compacted = compactLayout(updated, cols);
      this.layoutOverrides.update((prev) => ({ ...prev, [breakpoint]: compacted }));
    });
  }

  public registerItem(id: string, options: { el: HTMLElement; constraints: GridItemConstraints }) {
    this.itemElements.set(id, options.el);
    this.registerConstraints(id, options.constraints);
  }

  public unregisterItem(id: string) {
    this.itemElements.delete(id);
    this.contentElements.delete(id);
    this.constraintsRegistry.delete(id);
  }

  /**
   * The item's inner content wrapper. Used by the counter-scaled resize FLIP so the
   * box can scale while the content takes the inverse scale and stays undistorted.
   */
  public registerContentElement(id: string, el: HTMLElement) {
    if (this.contentElements.get(id) !== el) {
      this.contentElements.set(id, el);
    }
  }

  public setGhostElement(el: HTMLElement | null) {
    if (this.ghostElement !== el) {
      this.ghostElement = el;
      this.rectSnapshot.delete('__ghost__');
    }
  }

  public getConstraints(id: string): GridItemConstraints {
    return resolveItemConstraints(id, {
      itemConfigs: this.itemConfigs(),
      registrations: this.gridConfig.registrations,
      constraintsRegistry: this.constraintsRegistry,
    });
  }

  public snapshotRects() {
    this.rectSnapshot.clear();

    for (const [id, el] of this.itemElements) {
      this.rectSnapshot.set(id, el.getBoundingClientRect());
    }

    if (this.ghostElement) {
      this.rectSnapshot.set('__ghost__', this.ghostElement.getBoundingClientRect());
    }
  }

  public animateLayoutTransition(options?: { excludeIds?: Set<string>; durationMs?: number }) {
    const excludeIds = options?.excludeIds ?? new Set();
    const durationMs = options?.durationMs ?? 250;
    const snapshot = new Map(this.rectSnapshot);
    const ghostEl = this.ghostElement;
    const debug = isGridDebugEnabled();
    const scheduledAt = debug ? performance.now() : 0;

    afterNextRender(
      () => {
        const t0 = debug ? performance.now() : 0;

        // The FLIP is split into read → write → read → write phases so the loop never
        // interleaves a getBoundingClientRect() with a cancel() on the same element.
        // Interleaving forces the browser to recompute layout twice PER item, which
        // stalls the frame and shows up as an occasional chop on larger grids.
        type Flip = {
          el: HTMLElement;
          content: HTMLElement | null;
          running: Animation[];
          fromRect: DOMRect;
        };

        // Phase 1 — read every "from" rect together (no writes in between, so the
        // browser can serve them from a single layout pass).
        //  - Mid-animation elements: their snapshot (taken a frame earlier) is stale, so
        //    read the actual current on-screen rect and continue from exactly there.
        //  - Otherwise: use the snapshot, which holds the pre-layout-change position.
        const flips: Flip[] = [];

        for (const [id, el] of this.itemElements) {
          if (excludeIds.has(id)) continue;

          const running = el.getAnimations();
          const fromRect = running.length > 0 ? el.getBoundingClientRect() : snapshot.get(id);

          if (!fromRect) continue;

          flips.push({ el, content: this.contentElements.get(id) ?? null, running, fromRect });
        }

        const ghostRunning = ghostEl ? ghostEl.getAnimations() : [];
        let ghostFrom: DOMRect | undefined;
        if (ghostEl) {
          ghostFrom = ghostRunning.length > 0 ? ghostEl.getBoundingClientRect() : snapshot.get('__ghost__');
        }

        const interrupted = debug ? flips.filter((f) => f.running.length > 0).length : 0;
        const t1 = debug ? performance.now() : 0;

        // Phase 2 — cancel all in-flight animations (writes only).
        for (const flip of flips) {
          flip.running.forEach((a) => a.cancel());
          flip.content?.getAnimations().forEach((a) => a.cancel());
        }
        ghostRunning.forEach((a) => a.cancel());

        const t2 = debug ? performance.now() : 0;

        // Phase 3 — read every target rect together (single layout pass).
        const targets = flips.map((flip) => flip.el.getBoundingClientRect());
        const ghostTarget = ghostEl ? ghostEl.getBoundingClientRect() : null;

        const t3 = debug ? performance.now() : 0;
        let animated = 0;
        let maxDx = 0;
        let maxDy = 0;

        // Phase 4 — start the animations (writes only).
        flips.forEach((flip, i) => {
          const { el, content, fromRect } = flip;
          const newRect = targets[i];

          if (!newRect) return;

          const dx = fromRect.left - newRect.left;
          const dy = fromRect.top - newRect.top;
          const scaleX = newRect.width > 0 ? fromRect.width / newRect.width : 1;
          const scaleY = newRect.height > 0 ? fromRect.height / newRect.height : 1;
          const moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;
          const resized = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

          if (!moved && !resized) return;

          if (debug) {
            animated++;
            maxDx = Math.max(maxDx, Math.abs(dx));
            maxDy = Math.max(maxDy, Math.abs(dy));
          }

          if (resized) {
            // Counter-scaled FLIP: the box scales from its old to new size while the
            // content wrapper takes the inverse scale, so text/children never distort.
            // Easing is baked into sampled keyframes (played linearly) so the outer and
            // inner scales multiply to ~1 on every frame, not just at the endpoints.
            this.animateCounterScaled({ el, content, dx, dy, scaleX, scaleY, durationMs });
          } else {
            el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
              duration: durationMs,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
            });
          }
        });

        if (ghostEl && ghostFrom && ghostTarget) {
          const dx = ghostFrom.left - ghostTarget.left;
          const dy = ghostFrom.top - ghostTarget.top;

          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            ghostEl.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
              duration: 200,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
            });
          }
        }

        if (debug) {
          const t4 = performance.now();
          const gapSinceLast = this.lastFlipAt ? t0 - this.lastFlipAt : -1;
          this.lastFlipAt = t0;

          const round = (n: number) => Math.round(n * 100) / 100;
          const info = {
            items: flips.length,
            interrupted, // items already mid-animation when this FLIP started
            animated, // items that actually started a new animation
            maxDx: round(maxDx),
            maxDy: round(maxDy),
            renderDelay: round(t0 - scheduledAt), // schedule → afterNextRender gap
            readFrom: round(t1 - t0),
            cancel: round(t2 - t1),
            readTarget: round(t3 - t2),
            startAnim: round(t4 - t3),
            total: round(t4 - t0),
            gapSinceLast: round(gapSinceLast), // time between consecutive FLIPs
          };

          if (info.total > 6 || (gapSinceLast >= 0 && gapSinceLast < 12)) {
            gridDebug('flip ⚠', info);
          } else {
            gridDebug('flip', info);
          }
        }
      },
      { injector: this.injector },
    );
  }

  public beginDrag(itemId: string) {
    const entry = this.baseLayout().find((e) => e.id === itemId);

    if (!entry) return;

    this.dragState.set({
      itemId,
      originPosition: entry.position,
      targetPosition: entry.position,
    });
  }

  public updateDragTarget(targetPosition: GridItemPosition) {
    const drag = this.dragState();

    if (!drag) return;

    this.dragState.set({ ...drag, targetPosition });
  }

  public commitDrag() {
    const drag = this.dragState();

    if (!drag) return;

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
  }

  public addItem(type: string, data: unknown) {
    const id = crypto.randomUUID();

    const config: GridItemConfig = {
      id,
      type,
      data,
      layout: {},
    };

    this.placeItem(config);
  }

  public removeItem(id: string) {
    const el = this.itemElements.get(id);

    if (el) {
      const anim = el.animate(
        [
          { transform: 'scale(1)', opacity: '1' },
          { transform: 'scale(0.9)', opacity: '0' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
      );

      anim.onfinish = () => {
        anim.cancel();
        this.snapshotRects();
        this.itemConfigs.update((items) => items.filter((i) => i.id !== id));

        const columns = this.activeColumns();
        const currentLayout = this.baseLayout().filter((e) => e.id !== id);
        const compacted = compactLayout(currentLayout, columns);

        this.updateLayoutForCurrentBreakpoint(compacted);
        this.compactOtherBreakpoints(id);
        this.emitLayoutChange();
        this.animateLayoutTransition({ excludeIds: new Set([id]) });
      };
    } else {
      this.itemConfigs.update((items) => items.filter((i) => i.id !== id));

      const columns = this.activeColumns();
      const currentLayout = this.baseLayout().filter((e) => e.id !== id);
      const compacted = compactLayout(currentLayout, columns);

      this.updateLayoutForCurrentBreakpoint(compacted);
      this.compactOtherBreakpoints(id);
      this.emitLayoutChange();
    }
  }

  public moveItem(id: string, newPosition: GridItemPosition) {
    const columns = this.activeColumns();
    const item = this.itemConfigs().find((i) => i.id === id);

    if (!item) return;

    const clamped = clampPosition({ position: newPosition, constraints: this.getConstraints(id), columns });
    const currentLayout = this.baseLayout().map((e) => (e.id === id ? { ...e, position: clamped } : e));

    const resolved = resolveCollisions({ entries: currentLayout, movedId: id, columns });
    this.updateLayoutForCurrentBreakpoint(resolved);
    this.updateItemLayout(id, clamped);
    this.emitLayoutChange();
  }

  public resizeItem(options: ResizeItemOptions) {
    const { id, newColSpan, newRowSpan, newCol, newRow } = options;
    const columns = this.activeColumns();
    const item = this.itemConfigs().find((i) => i.id === id);

    // Use the stored pre-resize layout as the base (captures original neighbor positions)
    if (!this.resizeBaseLayout()) {
      this.resizeBaseLayout.set(this.baseLayout());
    }

    const base = this.resizeBaseLayout() ?? this.baseLayout();
    const entry = base.find((e) => e.id === id);

    if (!item || !entry) return;

    const newPosition: GridItemPosition = {
      col: newCol ?? entry.position.col,
      row: newRow ?? entry.position.row,
      colSpan: newColSpan,
      rowSpan: newRowSpan,
    };

    const clamped = clampPosition({ position: newPosition, constraints: this.getConstraints(id), columns });

    // Try to shrink horizontal neighbors before pushing them down
    const currentLayout = base.map((e) => (e.id === id ? { ...e, position: clamped } : e));

    const withShrunk = this.shrinkNeighbors({
      layout: currentLayout,
      resizedId: id,
      resizedPos: clamped,
      originalPos: entry.position,
      columns,
    });
    const resolved = resolveCollisions({ entries: withShrunk, movedId: id, columns });

    this.updateLayoutForCurrentBreakpoint(resolved);
    this.updateItemLayout(id, clamped);
    this.emitLayoutChange();
  }

  public commitResize() {
    this.resizeBaseLayout.set(null);
  }

  public getSerializedState(): GridSerializedState {
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

  public restoreState(state: GridSerializedState) {
    const items: GridItemConfig[] = state.items.map((item) => ({
      id: item.id,
      type: item.type,
      data: item.data,
      layout: { ...item.layout },
    }));

    this.itemConfigs.set(items);

    const overrides: Record<GridBreakpointName, GridLayoutEntry[]> = {};

    for (const [bpName, columns] of Object.entries(state.columns)) {
      overrides[bpName] = items.map((item) => ({
        id: item.id,
        position:
          item.layout[bpName] ??
          autoPlace({
            entries: [],
            colSpan: this.getConstraints(item.id).minColSpan,
            rowSpan: this.getConstraints(item.id).minRowSpan,
            columns,
          }),
      }));
    }

    this.layoutOverrides.set(overrides);
  }

  private placeItem(config: GridItemConfig) {
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
        existingItems.map((item) => ({
          id: item.id,
          position: item.layout[bp.name] ?? { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        }));

      layout[bp.name] = autoPlace({
        entries: bpEntries,
        colSpan: Math.min(constraints.minColSpan, bp.columns),
        rowSpan: constraints.minRowSpan,
        columns: bp.columns,
      });
    }

    const itemWithLayout: GridItemConfig = { ...config, layout };

    this.itemConfigs.update((items) => [...items, itemWithLayout]);
    this.updateLayoutForCurrentBreakpoint([...currentLayout, { id: config.id, position }]);
    this.emitLayoutChange();
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
        // Prefer sliding the neighbor right over shrinking it — only shrink if its
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
        // Prefer sliding the neighbor left over shrinking it — only shrink if its
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
      const compacted = compactLayout(withoutItem, cols);
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

  private animateCounterScaled(options: {
    el: HTMLElement;
    content: HTMLElement | null;
    dx: number;
    dy: number;
    scaleX: number;
    scaleY: number;
    durationMs: number;
  }) {
    const { el, content, dx, dy, scaleX, scaleY, durationMs } = options;
    const steps = 14;
    const outer: Keyframe[] = [];
    const inner: Keyframe[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — matches the translate easing feel
      const sx = scaleX + (1 - scaleX) * eased;
      const sy = scaleY + (1 - scaleY) * eased;
      const tx = dx * (1 - eased);
      const ty = dy * (1 - eased);

      outer.push({
        offset: t,
        transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
        transformOrigin: 'top left',
      });
      inner.push({ offset: t, transform: `scale(${1 / sx}, ${1 / sy})`, transformOrigin: 'top left' });
    }

    // Clip the box for the duration. When the item grows back (scaleX/scaleY < 1) the
    // content wrapper is counter-scaled UP past the box, and browsers count transformed
    // descendants in an ancestor's scrollable overflow — so without clipping the content
    // spills out and flashes scrollbars. overflow:hidden turns it into a clean reveal.
    // Only counter-scale sets this, and nothing else touches inline overflow, so
    // restoring to '' (back to the CSS value) on finish/cancel is safe.
    this.renderer.setStyle(el, { overflow: 'hidden' });
    const restore = () => this.renderer.removeStyles(el, 'overflow');

    const outerAnim = el.animate(outer, { duration: durationMs, easing: 'linear' });
    outerAnim.onfinish = restore;
    outerAnim.oncancel = restore;

    content?.animate(inner, { duration: durationMs, easing: 'linear' });
  }
}
