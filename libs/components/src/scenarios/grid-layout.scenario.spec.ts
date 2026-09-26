import { Component, input, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  autoPlace,
  clampPosition,
  clampResizeRect,
  compactLayout,
  computeGeometry,
  computeGridHeight,
  createAutoScroller,
  createGridAdapter,
  deserializeGridLayout,
  findCollision,
  findScrollableAncestor,
  fromGridPosition,
  GRID_IMPORTS,
  GridComponent,
  GridItemConfig,
  GridItemPosition,
  GridLayoutEntry,
  GridSerializedState,
  hysteresisRound,
  mapGridLayout,
  mapLayoutToBreakpoint,
  pixelRectsEqual,
  positionsEqual,
  positionToPixelRect,
  projectDragCell,
  provideGridConfig,
  resizeSpanBounds,
  resolveBreakpoint,
  resolveCollisions,
  rowsToPixelHeight,
  serializeGridLayout,
  SNAP_HYSTERESIS,
  snapResizeSpan,
  spanHeight,
  spanWidth,
  toGridPosition,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Card = { title: string };

type BackendBox = { x: number; y: number; cols: number; rows: number };

type StoredCard = { uid: string; kind: string; title: string; boxes: { desk: BackendBox; phone: BackendBox } };

const at = (col: number, row: number, colSpan = 1, rowSpan = 1): GridItemPosition => ({ col, row, colSpan, rowSpan });

const entry = (id: string, position: GridItemPosition): GridLayoutEntry => ({ id, position });

const STORED: StoredCard[] = [
  {
    uid: 'one',
    kind: 'card',
    title: 'Card one',
    boxes: { desk: { x: 0, y: 0, cols: 2, rows: 1 }, phone: { x: 0, y: 0, cols: 2, rows: 1 } },
  },
  {
    uid: 'two',
    kind: 'card',
    title: 'Card two',
    boxes: { desk: { x: 2, y: 0, cols: 3, rows: 2 }, phone: { x: 0, y: 1, cols: 2, rows: 2 } },
  },
];

const adapter = createGridAdapter({
  breakpoints: { desk: { columns: 6, minWidth: 700 }, phone: { columns: 2, minWidth: 0 } },
  fromExternal: (stored: StoredCard): GridItemConfig<string, Card, 'desk' | 'phone'> => ({
    id: stored.uid,
    type: stored.kind,
    data: { title: stored.title },
    layout: mapGridLayout(stored.boxes, toGridPosition),
  }),
  toExternal: (item): StoredCard => ({
    uid: item.id,
    kind: item.type,
    title: item.data.title,
    boxes: mapGridLayout(item.layout, fromGridPosition),
  }),
});

// jsdom loads no component stylesheets, so the dimension observer would see an inline host.
const UNSTYLED_BLOCKS = 'et-grid { display: block; }';

// 6 columns at 16px gaps leave 720px for cells: 120px per cell, 136px per stride.
const DESK_WIDTH = 800;

@Component({
  selector: 'et-scenario-card',
  template: `<p class="scenario-card">{{ data().title }}</p>`,
})
class CardComponent {
  data = input.required<Card>();
}

@Component({
  selector: 'et-scenario-synced-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-grid
      [items]="items"
      [breakpoints]="breakpoints"
      [rowHeight]="90"
      [gap]="16"
      (layoutChange)="saved = toBackend($event)"
    />
  `,
})
class SyncedBoardComponent {
  breakpoints = adapter.breakpoints;
  items = adapter.fromExternal(STORED);
  saved: StoredCard[] = [];
  grid = viewChild.required(GridComponent<Card>);

  toBackend(state: GridSerializedState<Card>) {
    return adapter.toExternal(state.items);
  }
}

@Component({
  selector: 'et-scenario-restored-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `<et-grid
    [items]="restored.items"
    [breakpoints]="restored.breakpoints"
    [rowHeight]="restored.rowHeight"
  />`,
})
class RestoredBoardComponent {
  restored = deserializeGridLayout<Card>(JSON.parse(localStorage.getItem('scenario-board') ?? 'null'), {
    desk: 700,
    phone: 0,
  });
  grid = viewChild.required(GridComponent<Card>);
}

const measured = (s: Scenario) => {
  let width = DESK_WIDTH;
  let faked = false;
  const observer = fakeResizeObserver();

  return (next = width) => {
    width = next;

    if (!faked) {
      faked = true;
      fakeLayout([{ match: '.et-grid', clientWidth: () => width }]);
    }

    s.tick();
    observer.fire();
    s.tick();
  };
};

const itemOf = (host: HTMLElement, title: string) => {
  const item = [...host.querySelectorAll<HTMLElement>('et-grid-item')].find((candidate) =>
    candidate.textContent?.includes(title),
  );

  if (!item) throw new Error(`no item ${title}`);

  return item;
};

describe('grid layout scenarios', () => {
  const scenario = useScenario({
    providers: [provideGridConfig({ registrations: [{ type: 'card', component: CardComponent }] })],
  });

  it('round-trips a backend item shape through an adapter bound into the grid', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(SyncedBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    expect(adapter.breakpoints).toEqual([
      { name: 'desk', columns: 6, minWidth: 700 },
      { name: 'phone', columns: 2, minWidth: 0 },
    ]);

    measure();

    expect(itemOf(host, 'Card two').style.translate).toBe('272px 0px');

    itemOf(host, 'Card two').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    s.tick();

    expect(board.saved).toEqual([
      STORED[0],
      { ...STORED[1], boxes: { desk: { x: 3, y: 0, cols: 3, rows: 2 }, phone: STORED[1]!.boxes.phone } },
    ]);

    s.flush();
  });

  it('persists a layout and restores it into a fresh grid', () => {
    const s = scenario();
    const measure = measured(s);
    const saved = serializeGridLayout({
      items: adapter.fromExternal(STORED),
      breakpoints: adapter.breakpoints,
      rowHeight: 90,
    });

    expect(saved.columns).toEqual({ desk: 6, phone: 2 });

    localStorage.setItem('scenario-board', JSON.stringify(saved));
    onTestFinished(() => localStorage.removeItem('scenario-board'));

    const fixture = TestBed.createComponent(RestoredBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure(400);

    expect(fixture.componentInstance.restored.breakpoints).toEqual(adapter.breakpoints);
    expect(fixture.componentInstance.grid().grid.activeBreakpoint()).toBe('phone');
    expect(itemOf(host, 'Card two').style.translate).toBe('0px 106px');
    expect(fixture.componentInstance.grid().grid.getSerializedState()).toEqual(saved);

    s.flush();
  });

  it('plans a layout change without a rendered grid', () => {
    const board = [entry('one', at(0, 0, 2, 1)), entry('two', at(2, 0, 3, 2)), entry('three', at(0, 1, 2, 1))];

    expect(findCollision({ entries: board, position: at(1, 1, 2, 1) })?.id).toBe('two');
    expect(findCollision({ entries: board, position: at(1, 1, 2, 1), excludeId: 'two' })?.id).toBe('three');
    expect(findCollision({ entries: board, position: at(5, 0) })).toBeUndefined();
    expect(autoPlace({ entries: board, colSpan: 2, rowSpan: 1, columns: 6 })).toEqual(at(0, 2, 2, 1));
    expect(autoPlace({ entries: board, colSpan: 1, rowSpan: 1, columns: 6 })).toEqual(at(5, 0, 1, 1));

    const constraints = { minColSpan: 2, maxColSpan: 4, minRowSpan: 1, maxRowSpan: 2 };

    expect(clampPosition({ position: at(5, -1, 8, 5), constraints, columns: 6 })).toEqual(at(2, 0, 4, 2));

    const moved = resolveCollisions({
      entries: board.map((item) => (item.id === 'three' ? entry('three', at(2, 0, 2, 1)) : item)),
      movedId: 'three',
      columns: 6,
    });

    expect(moved.find((item) => item.id === 'three')?.position).toEqual(at(2, 0, 2, 1));
    expect(
      moved.every((a, i) => moved.slice(i + 1).every((b) => !findCollision({ entries: [a], position: b.position }))),
    ).toBe(true);

    const withoutOne = compactLayout({ entries: board.filter((item) => item.id !== 'one'), columns: 6 });

    expect(withoutOne.find((item) => item.id === 'three')?.position).toEqual(at(0, 0, 2, 1));
    expect(computeGridHeight(board)).toBe(2);
    expect(computeGridHeight([])).toBe(0);

    const phone = mapLayoutToBreakpoint({ entries: board, fromColumns: 6, toColumns: 2 });

    expect(phone.map((item) => item.position)).toEqual([at(0, 0, 2, 1), at(0, 1, 2, 2), at(0, 3, 2, 1)]);
    expect(mapLayoutToBreakpoint({ entries: board, fromColumns: 6, toColumns: 12 })).toBe(board);

    expect(resolveBreakpoint(adapter.breakpoints, 900)).toBe('desk');
    expect(resolveBreakpoint(adapter.breakpoints, 699)).toBe('phone');
  });

  it('computes the same pixel geometry the grid renders', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(SyncedBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();

    const geometry = computeGeometry({ contentWidth: DESK_WIDTH, columns: 6, gap: 16, rowHeight: 90 });
    const two = itemOf(host, 'Card two');
    const rect = positionToPixelRect(at(2, 0, 3, 2), geometry);

    expect(geometry).toEqual(fixture.componentInstance.grid().grid.geometry());
    expect(two.style.translate).toBe(`${rect.x}px ${rect.y}px`);
    expect([two.style.width, two.style.height]).toEqual([
      `${spanWidth(3, geometry)}px`,
      `${spanHeight(2, geometry)}px`,
    ]);

    const layout = fixture.componentInstance.grid().grid.layout();

    expect(host.querySelector<HTMLElement>('et-grid')!.style.height).toBe(
      `${rowsToPixelHeight(computeGridHeight(layout), geometry)}px`,
    );
    expect(rowsToPixelHeight(0, geometry)).toBe(0);
    expect(pixelRectsEqual(rect, { x: 272, y: 0, width: 392, height: 196 })).toBe(true);
    expect(pixelRectsEqual(rect, null)).toBe(false);
    expect(positionsEqual(layout.find((item) => item.id === 'two')!.position, at(2, 0, 3, 2))).toBe(true);
    expect(positionsEqual(null, null)).toBe(true);

    s.flush();
  });

  it('snaps an app-built gesture to cells with hysteresis', () => {
    const geometry = computeGeometry({ contentWidth: DESK_WIDTH, columns: 6, gap: 16, rowHeight: 90 });
    const midpoint = 1.5 * geometry.strideX;

    expect(projectDragCell({ float: { x: midpoint + 1, y: 0 }, colSpan: 2, geometry, lastTarget: null })).toEqual({
      col: 2,
      row: 0,
    });
    expect(
      projectDragCell({ float: { x: midpoint + 1, y: 0 }, colSpan: 2, geometry, lastTarget: { col: 1, row: 0 } }),
    ).toEqual({ col: 1, row: 0 });
    expect(projectDragCell({ float: { x: 5000, y: -50 }, colSpan: 2, geometry, lastTarget: null })).toEqual({
      col: 4,
      row: 0,
    });

    expect(hysteresisRound(2.5 + SNAP_HYSTERESIS / 2, 2)).toBe(2);
    expect(hysteresisRound(2.5 + SNAP_HYSTERESIS * 2, 2)).toBe(3);
    expect(hysteresisRound(2.4, null)).toBe(2);

    const start = at(3, 0, 2, 1);
    const bounds = resizeSpanBounds({
      edge: 'e',
      start,
      constraints: { minColSpan: 1, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 },
      columns: 6,
    });

    expect(bounds).toEqual({ minColSpan: 1, maxColSpan: 3, minRowSpan: 1, maxRowSpan: 4 });

    const startRect = positionToPixelRect(start, geometry);
    const live = clampResizeRect({ edge: 'e', dx: 1000, dy: 0, startRect, bounds, geometry });

    expect(live.width).toBe(spanWidth(3, geometry));
    expect(snapResizeSpan({ edge: 'e', rect: live, start, bounds, geometry, lastSnap: null })).toEqual(at(3, 0, 3, 1));

    const west = resizeSpanBounds({ edge: 'w', start, constraints: bounds, columns: 6 });
    const leftward = clampResizeRect({ edge: 'w', dx: -geometry.strideX, dy: 0, startRect, bounds: west, geometry });

    expect(snapResizeSpan({ edge: 'w', rect: leftward, start, bounds: west, geometry, lastSnap: start })).toEqual(
      at(2, 0, 3, 1),
    );
  });

  it('scrolls the nearest scroll container while an app-built drag nears its edge', () => {
    const s = scenario();
    const container = document.createElement('div');
    const handle = document.createElement('div');

    container.style.overflowY = 'auto';
    container.appendChild(handle);
    document.body.appendChild(container);

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    container.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 300 }) as DOMRect;

    const scrollBy = vi.fn();

    container.scrollBy = scrollBy as typeof container.scrollBy;

    expect(findScrollableAncestor(handle)).toBe(container);
    expect(findScrollableAncestor(container)).toBeNull();

    const scroller = createAutoScroller({ document, getScrollElement: () => findScrollableAncestor(handle) });

    scroller.start({ clientX: 150, clientY: 100 });
    s.frame();
    expect(scrollBy).not.toHaveBeenCalled();

    scroller.update({ clientX: 150, clientY: 196 });
    s.frame();
    expect(scrollBy).toHaveBeenLastCalledWith(0, expect.any(Number));
    expect(scrollBy.mock.lastCall?.[1]).toBeGreaterThan(0);

    scroller.stop();
    expect(s.pendingFrames()).toBe(0);
    container.remove();
  });
});
