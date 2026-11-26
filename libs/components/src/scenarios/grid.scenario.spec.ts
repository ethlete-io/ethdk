import { Component, inject, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DEFAULT_BREAKPOINTS,
  DEFAULT_GRID_LABELS,
  GRID_ERROR_CODES,
  GRID_IMPORTS,
  GRID_LABELS,
  GridBreakpointConfig,
  GridComponent,
  GridItemComponent,
  GridItemConfig,
  GridItemDefaultActionsComponent,
  GridItemPosition,
  GridItemToolbarComponent,
  GridSerializedState,
  injectGridConfig,
  injectGridLabels,
  provideGridConfig,
  provideGridLabels,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Note = { title: string };

const at = (col: number, row: number, colSpan = 1, rowSpan = 1): GridItemPosition => ({ col, row, colSpan, rowSpan });

const note = (id: string, lg: GridItemPosition, type = 'note'): GridItemConfig<string, Note> => ({
  id,
  type,
  data: { title: `Note ${id}` },
  layout: { lg, md: at(0, lg.row, Math.min(lg.colSpan, 6), lg.rowSpan), sm: at(0, lg.row, 1, lg.rowSpan) },
});

const BOARD: GridItemConfig<string, Note>[] = [note('a', at(0, 0, 4, 2)), note('b', at(4, 0, 4, 1))];

// jsdom loads no component stylesheets, so the dimension observer would see an inline host.
const UNSTYLED_BLOCKS = 'et-grid, [etGrid] { display: block; }';

// 12 columns at 16px gaps leave 1200px for cells: 100px per cell, 116px per stride.
const LG_WIDTH = 1376;

@Component({
  selector: 'et-scenario-note',
  template: `<h3 class="scenario-note-title">{{ data().title }}</h3>`,
})
class NoteComponent {
  data = input.required<Note>();
}

@Component({
  selector: 'et-scenario-chart',
  template: `<p class="scenario-chart">{{ data().title }}</p>`,
})
class ChartComponent {
  data = input.required<Note>();
}

const REGISTRATIONS = [
  { type: 'note', component: NoteComponent },
  {
    type: 'chart',
    component: ChartComponent,
    constraints: { maxColSpan: 5, perBreakpoint: { md: { maxColSpan: 3 } } },
  },
];

@Component({
  selector: 'et-scenario-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-grid
      [items]="items()"
      [breakpoints]="breakpoints"
      [readOnly]="readOnly()"
      [rowHeight]="100"
      [gap]="16"
      (layoutChange)="changes.push($event)"
    />
  `,
})
class BoardComponent {
  items = signal(BOARD);
  readOnly = signal(false);
  breakpoints: GridBreakpointConfig[] = DEFAULT_BREAKPOINTS;
  changes: GridSerializedState<Note>[] = [];
  grid = viewChild.required(GridComponent<Note>);
}

@Component({
  selector: 'et-scenario-custom-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-grid [items]="items">
      @if (!removed()) {
        <et-grid-item #item [maxColSpan]="3" (remove)="removed.set(true)" itemId="free" ariaLabel="Free text">
          <p class="scenario-free">Free text</p>
          <et-grid-item-toolbar etGridItemAction>
            <button (click)="item.removeItem()" class="scenario-drop" type="button">Drop</button>
          </et-grid-item-toolbar>
        </et-grid-item>
      }
      <et-grid-item itemId="fixed">
        <p>Fixed</p>
        <et-grid-item-default-actions itemId="fixed" etGridItemAction />
      </et-grid-item>
    </et-grid>
  `,
})
class CustomBoardComponent {
  items: GridItemConfig[] = [
    { ...note('free', at(0, 0, 2, 1), 'free-text') },
    { ...note('fixed', at(2, 0, 2, 1), 'free-text') },
  ];
  removed = signal(false);
  grid = viewChild.required(GridComponent);
}

@Component({
  selector: 'et-scenario-label-reader',
  template: `<span class="scenario-labels">{{ labels().removeItem }}|{{ labels().readonlyGrid }}</span>`,
})
class LabelReaderComponent {
  labels = injectGridLabels();
  source = inject(GRID_LABELS);
}

@Component({
  selector: 'et-scenario-localized-board',
  imports: [GRID_IMPORTS, LabelReaderComponent],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  providers: [provideGridLabels({ interactiveGrid: 'Raster', item: 'Kachel', removeItem: 'Entfernen' })],
  template: `
    <et-grid [items]="items" />
    <et-scenario-label-reader />
  `,
})
class LocalizedBoardComponent {
  items = BOARD;
}

@Component({
  selector: 'et-scenario-actions',
  template: `<button class="scenario-pin" type="button">Pin {{ itemId() }} {{ data().title }}</button>`,
})
class PinActionsComponent {
  itemId = input.required<string>();
  data = input.required<Note>();
}

@Component({
  selector: 'et-scenario-pin-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  providers: [provideGridConfig({ registrations: REGISTRATIONS, actionsComponent: PinActionsComponent })],
  template: `<et-grid [items]="items" />`,
})
class PinBoardComponent {
  items = BOARD;
  config = injectGridConfig();
}

@Component({
  selector: 'et-scenario-bare-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  providers: [provideGridConfig({ registrations: REGISTRATIONS, actionsComponent: null })],
  template: `<et-grid [items]="items" />`,
})
class BareBoardComponent {
  items = BOARD;
}

@Component({
  selector: 'et-scenario-unknown-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `<et-grid [items]="items" />`,
})
class UnknownTypeBoardComponent {
  items = [note('x', at(0, 0), 'map')];
}

@Component({
  selector: 'et-scenario-double-board',
  imports: [GRID_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-grid [items]="items">
      <et-grid-item itemId="a">Twice</et-grid-item>
    </et-grid>
  `,
})
class DoubleRenderBoardComponent {
  items = [note('a', at(0, 0))];
}

const code = (value: number) => `ET${value}`;

const dropElementPayloads = (s: Scenario) =>
  s.errors.splice(
    0,
    s.errors.length,
    ...s.errors.filter((entry) => !(entry.source === 'console.error' && typeof entry.error === 'object')),
  );

const measured = (s: Scenario) => {
  let width = LG_WIDTH;
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

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const itemById = (host: HTMLElement, title: string) => {
  const item = [...host.querySelectorAll<HTMLElement>('et-grid-item')].find((candidate) =>
    candidate.textContent?.includes(title),
  );

  if (!item) throw new Error(`no item ${title}`);

  return item;
};

const press = (s: Scenario, target: HTMLElement, key: string, modifiers: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });

  target.dispatchEvent(event);
  s.tick();

  return event;
};

const positionsOf = (state: GridSerializedState<Note> | undefined, breakpoint = 'lg') =>
  Object.fromEntries((state?.items ?? []).map((item) => [item.id, item.layout[breakpoint]]));

describe('grid scenarios', () => {
  const scenario = useScenario({ providers: [provideGridConfig({ registrations: REGISTRATIONS })] });

  it('renders each registered item into its slot once the container has a width', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    expect(host.querySelectorAll('et-grid-item')).toHaveLength(0);

    measure();

    const grid = query('et-grid', host);
    const a = itemById(host, 'Note a');
    const b = itemById(host, 'Note b');

    expect(grid.getAttribute('role')).toBe('region');
    expect(grid.getAttribute('aria-label')).toBe(DEFAULT_GRID_LABELS.interactiveGrid);
    expect(query('.scenario-note-title', a).textContent).toBe('Note a');
    expect(a.getAttribute('role')).toBe('group');
    expect(a.getAttribute('tabindex')).toBe('0');
    expect([a.style.translate, a.style.width, a.style.height]).toEqual(['0px 0px', '448px', '216px']);
    expect([b.style.translate, b.style.width, b.style.height]).toEqual(['464px 0px', '448px', '100px']);
    expect(grid.style.height).toBe('216px');
    expect(query('.et-grid-item-default-actions__remove', a).getAttribute('aria-label')).toBe(
      DEFAULT_GRID_LABELS.removeItem,
    );
    expect(fixture.componentInstance.changes).toEqual([]);

    s.flush();
  });

  it('moves, resizes and removes an item from the keyboard and reports each change', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const { changes } = fixture.componentInstance;

    measure();

    const b = itemById(host, 'Note b');

    press(s, b, 'ArrowRight', { ctrlKey: true });
    expect(positionsOf(changes.at(-1))).toEqual({ a: at(0, 0, 4, 2), b: at(5, 0, 4, 1) });
    expect(b.style.translate).toBe('580px 0px');

    press(s, b, 'ArrowRight', { shiftKey: true });
    expect(positionsOf(changes.at(-1))['b']).toEqual(at(5, 0, 5, 1));

    const event = press(s, b, 'ArrowLeft', { metaKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(positionsOf(changes.at(-1))['b']).toEqual(at(4, 0, 5, 1));

    press(s, itemById(host, 'Note a'), 'ArrowRight', { ctrlKey: true });
    const after = positionsOf(changes.at(-1));

    const [a, b2] = [after['a']!, after['b']!];

    expect(
      a.col < b2.col + b2.colSpan &&
        b2.col < a.col + a.colSpan &&
        a.row < b2.row + b2.rowSpan &&
        b2.row < a.row + a.rowSpan,
    ).toBe(false);

    const beforeRemove = changes.length;

    press(s, b, 'Delete', { ctrlKey: true });
    expect(b.classList.contains('et-grid-item--leaving')).toBe(true);
    s.tick(200);

    expect(host.textContent).not.toContain('Note b');
    expect(changes).toHaveLength(beforeRemove + 1);
    expect(changes.at(-1)?.items.map((item) => item.id)).toEqual(['a']);
    expect(changes.at(-1)?.columns).toEqual({ lg: 12, md: 6, sm: 2 });
    expect(changes.at(-1)?.rowHeight).toBe(100);

    s.flush();
  });

  it('removes an item through the default remove action', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();
    query<HTMLButtonElement>('.et-grid-item-default-actions__remove', itemById(host, 'Note a')).click();
    s.tick(200);

    expect(host.textContent).not.toContain('Note a');
    expect(fixture.componentInstance.changes.at(-1)?.items.map((item) => item.id)).toEqual(['b']);
    expect(positionsOf(fixture.componentInstance.changes.at(-1))['b']).toEqual(at(4, 0, 4, 1));

    s.flush();
  });

  it('ignores keyboard edits while read-only and labels the grid as such', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();
    fixture.componentInstance.readOnly.set(true);
    s.tick();

    const grid = query('et-grid', host);
    const b = itemById(host, 'Note b');
    const event = press(s, b, 'ArrowRight', { ctrlKey: true });

    expect(grid.classList.contains('et-grid--readonly')).toBe(true);
    expect(grid.getAttribute('aria-label')).toBe(DEFAULT_GRID_LABELS.readonlyGrid);
    expect(event.defaultPrevented).toBe(false);
    expect(b.style.translate).toBe('464px 0px');
    expect(fixture.componentInstance.changes).toEqual([]);

    s.flush();
  });

  it('switches to the breakpoint the container width falls into without reporting a change', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const { grid } = fixture.componentInstance;

    measure();
    expect(grid().grid.activeBreakpoint()).toBe('lg');

    measure(800);
    s.tick(150);

    expect(grid().grid.activeBreakpoint()).toBe('md');
    expect(grid().grid.activeColumns()).toBe(6);
    expect(itemById(host, 'Note b').style.translate).toBe('0px 232px');
    expect(itemById(host, 'Note a').style.width).toBe('528px');

    measure(400);
    s.tick(150);

    expect(grid().grid.activeBreakpoint()).toBe('sm');
    expect(itemById(host, 'Note a').style.width).toBe('192px');
    expect(fixture.componentInstance.changes).toEqual([]);

    s.flush();
  });

  it('reconciles the items input: added and removed items are silent, a data change re-renders', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    measure();

    board.items.set([...BOARD, note('c', at(8, 0, 4, 1))]);
    s.tick();
    expect(itemById(host, 'Note c').style.translate).toBe('928px 0px');

    board.items.set(BOARD.map((item) => (item.id === 'a' ? { ...item, data: { title: 'Renamed' } } : item)));
    s.tick(200);

    expect(host.textContent).not.toContain('Note c');
    expect(host.textContent).toContain('Renamed');
    expect(board.changes).toEqual([]);

    s.flush();
  });

  it('adds an item at the first free slot and restores a saved state', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    measure();

    const saved = board.grid().grid.getSerializedState();

    board.grid().grid.addItem('chart', { title: 'Revenue' });
    s.tick();

    const chart = query('.scenario-chart', host).closest<HTMLElement>('et-grid-item')!;

    expect(chart.style.translate).toBe('928px 0px');
    expect(board.changes.at(-1)?.items).toHaveLength(3);

    press(s, chart, 'ArrowRight', { shiftKey: true });
    press(s, chart, 'ArrowRight', { shiftKey: true });
    expect(board.grid().grid.getSerializedState().items.at(-1)?.layout['lg']?.colSpan).toBe(3);

    for (let i = 0; i < 4; i++) press(s, chart, 'ArrowRight', { shiftKey: true });
    expect(board.grid().grid.getSerializedState().items.at(-1)?.layout['lg']?.colSpan).toBe(5);

    board.grid().grid.restoreState(saved);
    s.tick(200);

    expect(host.querySelector('.scenario-chart')).toBeNull();
    expect(board.grid().grid.getSerializedState()).toEqual(saved);

    s.flush();
  });

  it('caps a registration constraint per breakpoint', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const board = fixture.componentInstance;

    board.items.set([note('c', at(0, 0, 2, 1), 'chart')]);
    measure(800);

    expect(board.grid().grid.getConstraints('c')).toEqual({
      minColSpan: 1,
      maxColSpan: 3,
      minRowSpan: 1,
      maxRowSpan: 24,
    });

    measure(LG_WIDTH);
    s.tick(150);

    expect(board.grid().grid.getConstraints('c').maxColSpan).toBe(5);

    s.flush();
  });

  it('renders projected items with a custom toolbar and the default actions', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(CustomBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    measure();

    const free = itemById(host, 'Free text');

    expect(free.getAttribute('aria-label')).toBe('Free text');
    expect(query('et-grid-item-toolbar', free).classList.contains('et-grid-item-toolbar')).toBe(true);
    expect(fixture.debugElement.queryAll(By.directive(GridItemToolbarComponent))).toHaveLength(2);
    expect(fixture.debugElement.queryAll(By.directive(GridItemDefaultActionsComponent))).toHaveLength(1);

    const fixed = fixture.debugElement
      .queryAll(By.directive(GridItemComponent))
      .find((item) => item.nativeElement.textContent.includes('Fixed'))!
      .injector.get(GridItemComponent);

    for (let i = 0; i < 3; i++) press(s, free, 'ArrowRight', { shiftKey: true });
    expect(board.grid().grid.getSerializedState().items[0]?.layout['lg']?.colSpan).toBe(3);

    query<HTMLButtonElement>('.scenario-drop', free).click();
    s.tick(200);

    expect(board.removed()).toBe(true);
    expect(host.textContent).not.toContain('Free text');

    const fixedRemoved = vi.fn();

    fixed.remove.subscribe(fixedRemoved);
    query<HTMLButtonElement>('.et-grid-item-default-actions__remove', host).click();
    s.tick(200);

    expect(fixedRemoved).toHaveBeenCalledOnce();

    expect(board.grid().grid.currentItems()).toEqual([]);

    s.flush();
  });

  it('localizes the grid labels below a component', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(LocalizedBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();

    expect(query('et-grid', host).getAttribute('aria-label')).toBe('Raster');
    expect(query('.et-grid-item-default-actions__remove', host).getAttribute('aria-label')).toBe('Entfernen');
    expect(query('.et-grid-item', host).getAttribute('aria-label')).toBe('Kachel');
    expect(query('.scenario-labels', host).textContent).toBe(`Entfernen|${DEFAULT_GRID_LABELS.readonlyGrid}`);
    expect(fixture.debugElement.query(By.directive(LabelReaderComponent)).componentInstance.source).toEqual({
      interactiveGrid: 'Raster',
      item: 'Kachel',
      removeItem: 'Entfernen',
    });

    s.flush();
  });

  it('swaps or drops the item actions through the grid config', () => {
    const s = scenario();
    const measure = measured(s);
    const pinned = TestBed.createComponent(PinBoardComponent);
    const host = pinned.nativeElement as HTMLElement;

    measure();

    expect(pinned.componentInstance.config.actionsComponent).toBe(PinActionsComponent);
    expect(query('.scenario-pin', itemById(host, 'Note a')).textContent).toBe('Pin a Note a');
    expect(host.querySelector('et-grid-item-default-actions')).toBeNull();

    const bare = TestBed.createComponent(BareBoardComponent);

    measure();

    expect((bare.nativeElement as HTMLElement).querySelectorAll('et-grid-item')).toHaveLength(2);
    expect((bare.nativeElement as HTMLElement).querySelector('.et-grid-item__actions')?.children).toHaveLength(0);

    s.flush();
  });

  it('throws in dev when an item type has no renderer or is rendered twice', () => {
    const s = scenario();
    const measure = measured(s);

    TestBed.createComponent(UnknownTypeBoardComponent);
    measure();
    s.tick(1);
    s.expectError(code(GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE));
    dropElementPayloads(s);

    TestBed.createComponent(DoubleRenderBoardComponent);
    measure();
    s.tick(1);
    s.expectError(code(GRID_ERROR_CODES.DUPLICATE_ITEM_RENDER));
    dropElementPayloads(s);

    s.flush();
  });

  it('rejects duplicate ids and foreign breakpoints, and warns about a partial layout', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(BoardComponent);
    const board = fixture.componentInstance;

    measure();

    expect(() => board.grid().grid.restoreState({ columns: { xl: 16 }, rowHeight: 100, items: [] })).toThrow(
      code(GRID_ERROR_CODES.INVALID_LAYOUT_STATE),
    );

    board.items.set([note('a', at(0, 0)), note('a', at(1, 0))]);
    expect(() => fixture.detectChanges()).not.toThrow();
    s.tick();
    s.expectError(code(GRID_ERROR_CODES.DUPLICATE_ITEM_ID));
    expect(board.grid().grid.currentItems()).toEqual([]);
    expect(fixture.nativeElement.querySelector('et-grid-item, .et-grid-item')).toBeNull();

    board.items.set([{ id: 'p', type: 'note', data: { title: 'Partial' }, layout: { lg: at(0, 0) } }]);
    s.tick(200);
    s.expectWarning('has no position for "md", "sm"');
    dropElementPayloads(s);

    s.flush();
  });
});
