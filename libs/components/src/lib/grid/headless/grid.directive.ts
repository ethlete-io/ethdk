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
import { signalHostElementDimensions } from '@ethlete/core';
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

  public breakpoints = input<GridBreakpointConfig[]>(DEFAULT_BREAKPOINTS);
  public rowHeight = input(100);
  public gap = input(16);
  public initialItems = input<GridItemConfig[]>([]);
  public readOnly = input(false, { transform: booleanAttribute });

  public layoutChange = output<GridSerializedState>();
  private gridConfig = injectGridConfig();

  public registrations = computed(() => this.gridConfig.registrations);

  private dimensions = signalHostElementDimensions();
  private itemConfigs = signal<GridItemConfig[]>([]);
  private layoutOverrides = signal<Record<GridBreakpointName, GridLayoutEntry[]>>({});
  public dragState = signal<GridDragState | null>(null);

  private constraintsRegistry = new Map<string, GridItemConstraints>();

  private resizeBaseLayout = signal<GridLayoutEntry[] | null>(null);

  private itemElements = new Map<string, HTMLElement>();
  private ghostElement: HTMLElement | null = null;
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

        const currentIds = new Set(current.map((c) => c.id));
        const newItems = initial.filter((item) => !currentIds.has(item.id));

        for (const item of newItems) {
          this.placeItem(item);
        }

        // Remove items no longer in initial
        const initialIds = new Set(initial.map((i) => i.id));
        const removedIds = current.filter((c) => !initialIds.has(c.id)).map((c) => c.id);

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
  }

  public registerItem(id: string, options: { el: HTMLElement; constraints: GridItemConstraints }) {
    this.itemElements.set(id, options.el);
    this.registerConstraints(id, options.constraints);
  }

  public unregisterItem(id: string) {
    this.itemElements.delete(id);
    this.constraintsRegistry.delete(id);
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

  public animateLayoutTransition(options?: { excludeIds?: Set<string>; scaleIds?: Set<string> }) {
    const excludeIds = options?.excludeIds ?? new Set();
    const snapshot = new Map(this.rectSnapshot);
    const ghostEl = this.ghostElement;

    afterNextRender(
      () => {
        for (const [id, el] of this.itemElements) {
          if (excludeIds.has(id)) continue;

          const oldRect = snapshot.get(id);

          if (!oldRect) continue;

          const newRect = el.getBoundingClientRect();
          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;
          const scaleX = oldRect.width / newRect.width;
          const scaleY = oldRect.height / newRect.height;
          const hasMoved = Math.abs(dx) > 1 || Math.abs(dy) > 1;
          const hasResized = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

          if (!hasMoved && !hasResized) continue;

          el.getAnimations().forEach((a) => a.cancel());

          if (hasResized) {
            el.animate(
              [
                { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' },
                { transform: 'translate(0px, 0px) scale(1, 1)', transformOrigin: 'top left' },
              ],
              { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
            );
          } else {
            el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
              duration: 250,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
            });
          }
        }

        if (ghostEl) {
          const oldRect = snapshot.get('__ghost__');

          if (oldRect) {
            const newRect = ghostEl.getBoundingClientRect();
            const dx = oldRect.left - newRect.left;
            const dy = oldRect.top - newRect.top;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
              ghostEl.getAnimations().forEach((a) => a.cancel());
              ghostEl.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
                duration: 200,
                easing: 'cubic-bezier(0.2, 0, 0, 1)',
              });
            }
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
        this.emitLayoutChange();
        this.animateLayoutTransition({ excludeIds: new Set([id]) });
      };
    } else {
      this.itemConfigs.update((items) => items.filter((i) => i.id !== id));

      const columns = this.activeColumns();
      const currentLayout = this.baseLayout().filter((e) => e.id !== id);
      const compacted = compactLayout(currentLayout, columns);

      this.updateLayoutForCurrentBreakpoint(compacted);
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
    return serializeGridLayout({
      items: this.itemConfigs(),
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
    const breakpoint = this.activeBreakpoint();
    const columns = this.activeColumns();
    const currentLayout = this.baseLayout();
    const constraints = this.getConstraints(config.id);

    const position =
      config.layout[breakpoint] ??
      autoPlace({
        entries: currentLayout,
        colSpan: constraints.minColSpan,
        rowSpan: constraints.minRowSpan,
        columns,
      });

    const itemWithLayout: GridItemConfig = {
      ...config,
      layout: {
        ...config.layout,
        [breakpoint]: position,
      },
    };

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
