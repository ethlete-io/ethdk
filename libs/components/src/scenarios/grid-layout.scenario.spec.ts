import { Component, input, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createGridAdapter,
  deserializeGridLayout,
  fromGridPosition,
  GRID_IMPORTS,
  GridComponent,
  GridItemConfig,
  GridSerializedState,
  mapGridLayout,
  provideGridConfig,
  serializeGridLayout,
  toGridPosition,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Card = { title: string };

type BackendBox = { x: number; y: number; cols: number; rows: number };

type StoredCard = { uid: string; kind: string; title: string; boxes: { desk: BackendBox; phone: BackendBox } };

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

  it('renders items at the cells their positions span', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(SyncedBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();

    const two = itemOf(host, 'Card two');

    expect(two.style.translate).toBe('272px 0px');
    expect([two.style.width, two.style.height]).toEqual(['392px', '196px']);
    expect(host.querySelector<HTMLElement>('et-grid')!.style.height).toBe('196px');
    expect(fixture.componentInstance.grid().grid.geometry()).toMatchObject({ columns: 6, gap: 16, rowHeight: 90 });

    s.flush();
  });
});
