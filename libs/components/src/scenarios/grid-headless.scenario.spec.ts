import { JsonPipe } from '@angular/common';
import { Component, inject, input, signal, Signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  GRID_DEBUG_IMPORTS,
  GRID_ERROR_CODES,
  GRID_IMPORTS,
  GRID_TOKEN,
  GridBreakpointConfig,
  GridComponent,
  GridDebugComponent,
  GridDirective,
  GridDragDirective,
  GridItemConfig,
  GridItemDirective,
  GridItemPosition,
  GridItemRef,
  GridResizeDirective,
  GridSerializedState,
  provideGridConfig,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Tile = { title: string };

const at = (col: number, row: number, colSpan = 1, rowSpan = 1): GridItemPosition => ({ col, row, colSpan, rowSpan });

const BREAKPOINTS: GridBreakpointConfig[] = [
  { name: 'wide', columns: 8, minWidth: 600 },
  { name: 'narrow', columns: 4, minWidth: 0 },
];

const tile = (
  id: string,
  wide: GridItemPosition,
  narrow = at(0, wide.row, 2, wide.rowSpan),
): GridItemConfig<string, Tile> => ({
  id,
  type: 'tile',
  data: { title: `Tile ${id}` },
  layout: { wide, narrow },
});

const TILES = [tile('a', at(0, 0, 2, 1)), tile('b', at(2, 0, 2, 1)), tile('c', at(4, 0, 2, 2))];

// jsdom loads no component stylesheets, so the dimension observer would see an inline host.
const UNSTYLED_BLOCKS = '[etGrid], et-grid { display: block; }';

// 8 columns at 10px gaps leave 800px for cells: 100px per cell, 110px per stride.
const WIDE_WIDTH = 870;

@Component({
  selector: 'et-scenario-tile-meta',
  template: `<span class="scenario-meta">{{ grid.activeBreakpoint() }}:{{ grid.activeColumns() }}</span>`,
})
class TileMetaComponent {
  grid = inject(GRID_TOKEN);
}

@Component({
  selector: 'et-scenario-resize-grip',
  template: `<span [class.scenario-grip--active]="resize.isResizing()" class="scenario-grip"></span>`,
})
class ResizeGripComponent {
  resize = inject(GridResizeDirective);
  drag = inject(GridDragDirective);
}

@Component({
  selector: 'et-scenario-headless-board',
  imports: [
    JsonPipe,
    GridDirective,
    GridItemDirective,
    GridDragDirective,
    GridResizeDirective,
    TileMetaComponent,
    ResizeGripComponent,
  ],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <section
      #grid="etGrid"
      [items]="items()"
      [breakpoints]="breakpoints"
      [rowHeight]="80"
      [gap]="10"
      [readOnly]="readOnly()"
      (layoutChange)="changes.push($event)"
      etGrid
    >
      @for (item of grid.currentItems(); track item.id) {
        <article
          #cell="etGridItem"
          [itemId]="item.id"
          [minColSpan]="2"
          [perBreakpointConstraints]="{ narrow: { maxColSpan: 2 } }"
          [attr.data-id]="item.id"
          [attr.data-slot]="cell.currentPosition() | json"
          etGridItem
          etGridDrag
          etGridResize
        >
          {{ item.data.title }}
          <et-scenario-resize-grip />
          <et-scenario-tile-meta />
        </article>
      }
    </section>
  `,
})
class HeadlessBoardComponent {
  items = signal(TILES);
  readOnly = signal(false);
  breakpoints = BREAKPOINTS;
  changes: GridSerializedState<Tile>[] = [];
  grid = viewChild.required(GridDirective<Tile>);
}

@Component({
  selector: 'et-scenario-tile',
  template: `<b class="scenario-tile">{{ data().title }}</b>`,
})
class TileComponent {
  data = input.required<Tile>();
}

@Component({
  selector: 'et-scenario-debug-board',
  imports: [GRID_IMPORTS, GRID_DEBUG_IMPORTS],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <et-grid #board [items]="items()" [breakpoints]="breakpoints" [rowHeight]="80" [gap]="10" />
    <et-grid-debug [grid]="board" [externalItems]="items()" />
  `,
})
class DebugBoardComponent {
  items = signal(TILES);
  breakpoints = BREAKPOINTS;
  grid = viewChild.required(GridComponent<Tile>);
}

class TileSettingsRef extends GridItemRef<Tile> {
  saved: Tile[] = [];
  closed = 0;

  constructor(public readonly data: Signal<Tile | undefined>) {
    super();
  }

  save(data: Tile) {
    this.saved.push(data);
  }

  close() {
    this.closed++;
  }
}

@Component({
  selector: 'et-scenario-tile-settings',
  template: `
    <button (click)="ref.save({ title: 'Renamed' })" class="scenario-save" type="button">Save</button>
    <button (click)="ref.close()" class="scenario-close" type="button">Close</button>
    <span class="scenario-settings-title">{{ ref.data()?.title }}</span>
  `,
})
class TileSettingsComponent {
  ref = inject(GridItemRef<Tile>);
}

@Component({
  selector: 'et-scenario-settings-host',
  imports: [TileSettingsComponent],
  providers: [{ provide: GridItemRef, useFactory: () => new TileSettingsRef(signal({ title: 'Tile a' })) }],
  template: `<et-scenario-tile-settings />`,
})
class SettingsHostComponent {
  ref = inject(GridItemRef) as TileSettingsRef;
}

@Component({
  selector: 'et-scenario-stray-item',
  imports: [GridItemDirective],
  template: `<div itemId="lost" etGridItem></div>`,
})
class StrayItemComponent {}

@Component({
  selector: 'et-scenario-stray-drag',
  imports: [GridDirective, GridDragDirective, GridResizeDirective],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div etGrid>
      <div etGridDrag></div>
      <div etGridResize></div>
    </div>
  `,
})
class StrayDragComponent {}

const code = (value: number) => `ET${value}`;

const measured = (s: Scenario) => {
  let width = WIDE_WIDTH;
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

const dropElementPayloads = (s: Scenario) =>
  s.errors.splice(
    0,
    s.errors.length,
    ...s.errors.filter((entry) => !(entry.source === 'console.error' && typeof entry.error === 'object')),
  );

const cell = (host: HTMLElement, id: string) => {
  const element = host.querySelector<HTMLElement>(`[data-id="${id}"]`);

  if (!element) throw new Error(`no cell ${id}`);

  return element;
};

const slot = (host: HTMLElement, id: string) => JSON.parse(cell(host, id).dataset['slot'] ?? 'null');

describe('grid headless scenarios', () => {
  const scenario = useScenario({
    providers: [provideGridConfig({ registrations: [{ type: 'tile', component: TileComponent }] })],
  });

  it('lets an app render its own items with the headless directives', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(HeadlessBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();

    const a = cell(host, 'a');
    const section = host.querySelector<HTMLElement>('section')!;

    expect(section.classList.contains('et-grid')).toBe(true);
    expect(section.style.height).toBe('170px');
    expect(section.style.getPropertyValue('--et-grid-gap')).toBe('10px');
    expect(slot(host, 'c')).toEqual(at(4, 0, 2, 2));
    expect(a.style.translate).toBe('0px 0px');
    expect(a.style.width).toBe(`${2 * 100 + 10}px`);
    expect(cell(host, 'b').style.translate).toBe('220px 0px');
    expect(a.classList.contains('et-grid-drag')).toBe(true);
    expect(a.classList.contains('et-grid-resize')).toBe(true);
    expect(a.style.touchAction).toBe('none');
    expect(a.getAttribute('aria-grabbed')).toBe('false');
    expect(a.querySelector('.scenario-meta')?.textContent).toBe('wide:8');

    fixture.componentInstance.readOnly.set(true);
    s.tick();
    expect(a.style.touchAction).toBe('auto');

    measure(500);
    s.tick(150);

    expect(a.querySelector('.scenario-meta')?.textContent).toBe('narrow:4');
    expect(slot(host, 'b')).toEqual(at(0, 1, 2, 1));
    expect(fixture.componentInstance.changes).toEqual([]);

    s.flush();
  });

  it('commits a programmatic drag to the target cell and shows the ghost while it runs', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(HeadlessBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    measure();

    const grid = board.grid();

    expect(grid.beginDrag('a')).toEqual(at(0, 0, 2, 1));
    grid.updateDragTarget({ col: 6, row: 0 });
    s.tick();

    expect(grid.ghostPosition()).toEqual(at(6, 0, 2, 1));
    expect(grid.dragState()?.itemId).toBe('a');

    expect(grid.commitDrag()).toEqual(at(6, 0, 2, 1));
    s.tick();

    expect(slot(host, 'a')).toEqual(at(6, 0, 2, 1));
    expect(board.changes.at(-1)?.items.find((item) => item.id === 'a')?.layout['wide']).toEqual(at(6, 0, 2, 1));

    grid.beginDrag('b');
    grid.updateDragTarget({ col: 0, row: 3 });
    grid.cancelDrag();
    s.tick();

    expect(slot(host, 'b')).toEqual(at(2, 0, 2, 1));
    expect(grid.ghostPosition()).toBeNull();

    s.flush();
  });

  it('resizes from an app-built grip through the resize directive and cancels on Escape', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(HeadlessBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    measure();

    const grip = fixture.debugElement.queryAll(By.directive(ResizeGripComponent))[0]!
      .componentInstance as ResizeGripComponent;

    expect(grip.resize.resizeEdges()).toEqual(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']);
    expect(grip.drag.dragHandle.isDragging()).toBe(false);

    grip.resize.beginResize();
    s.tick();
    expect(cell(host, 'a').classList.contains('et-grid-resize--active')).toBe(true);
    expect(cell(host, 'a').classList.contains('et-grid-item--direct')).toBe(true);

    grip.resize.updateResize({ edge: 'e', dx: 200, dy: 0, clientX: 400, clientY: 40 });
    s.tick();
    expect(cell(host, 'a').style.width).toBe('410px');

    grip.resize.finishResize();
    s.tick(400);

    expect(slot(host, 'a')).toEqual(at(0, 0, 4, 1));
    expect(board.changes.at(-1)?.items.find((item) => item.id === 'a')?.layout['wide']).toEqual(at(0, 0, 4, 1));
    expect(slot(host, 'b')).not.toEqual(at(2, 0, 2, 1));

    const changes = board.changes.length;

    grip.resize.beginResize();
    grip.resize.updateResize({ edge: 's', dx: 0, dy: 180, clientX: 40, clientY: 260 });
    s.tick();
    s.keydown('Escape', document);
    s.tick(400);

    expect(slot(host, 'a')).toEqual(at(0, 0, 4, 1));
    expect(board.changes).toHaveLength(changes);

    s.flush();
  });

  it('narrows the resize edges to what the per-breakpoint bounds allow', () => {
    const s = scenario();
    const measure = measured(s);
    const fixture = TestBed.createComponent(HeadlessBoardComponent);

    measure(500);

    const grip = fixture.debugElement.queryAll(By.directive(ResizeGripComponent))[0]!
      .componentInstance as ResizeGripComponent;

    expect(fixture.componentInstance.grid().getConstraints('a')).toEqual({
      minColSpan: 2,
      maxColSpan: 2,
      minRowSpan: 1,
      maxRowSpan: 24,
    });
    expect(grip.resize.resizeEdges()).toEqual(['n', 's']);

    s.flush();
  });

  it('shows the grid state and flags items the host has not caught up with in the debug panel', async () => {
    const s = scenario();
    const measure = measured(s);
    const writeText = vi.fn(() => Promise.resolve());
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    onTestFinished(() => {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    });

    const fixture = TestBed.createComponent(DebugBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    measure();

    const panel = host.querySelector<HTMLElement>('et-grid-debug')!;

    expect(panel.querySelector('.et-grid-debug-summary')?.textContent).toContain('wide');
    expect(panel.querySelector('.et-grid-debug-summary')?.textContent).toContain(`${WIDE_WIDTH}px`);
    expect(panel.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(panel.querySelector('.et-grid-debug-issues')).toBeNull();

    fixture.componentInstance.grid().grid.moveItem('a', at(6, 0, 2, 1));
    s.tick();

    expect(panel.querySelector('.et-grid-debug-issues')?.textContent?.trim()).toMatch(/^⚠ \d+ issues?$/);

    panel.querySelector<HTMLButtonElement>('.et-grid-debug-copy')!.click();
    s.tick();
    await Promise.resolve();

    const snapshot = JSON.parse((writeText.mock.calls[0] as unknown as [string])[0]);

    expect(snapshot.activeBreakpoint).toBe('wide');
    expect(snapshot.issues).toContainEqual({ type: 'external-internal-mismatch', itemId: 'a', breakpoint: 'wide' });
    expect(panel.querySelector('.et-grid-debug-copied')).not.toBeNull();

    s.tick(2000);
    expect(panel.querySelector('.et-grid-debug-copied')).toBeNull();
    expect(fixture.debugElement.query(By.directive(GridDebugComponent))).toBeTruthy();

    s.flush();
  });

  it('hands an app-provided GridItemRef to a settings component', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SettingsHostComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    expect(host.querySelector('.scenario-settings-title')?.textContent).toBe('Tile a');

    host.querySelector<HTMLButtonElement>('.scenario-save')!.click();
    host.querySelector<HTMLButtonElement>('.scenario-close')!.click();

    expect(fixture.componentInstance.ref.saved).toEqual([{ title: 'Renamed' }]);
    expect(fixture.componentInstance.ref.closed).toBe(1);

    s.flush();
  });

  it('throws in dev when an item or its gestures sit outside their parent', () => {
    const s = scenario();

    TestBed.createComponent(StrayItemComponent);
    s.tick(1);
    s.expectError(code(GRID_ERROR_CODES.MISSING_GRID));

    TestBed.createComponent(StrayDragComponent);
    s.tick(1);
    s.expectError(`${code(GRID_ERROR_CODES.MISSING_GRID_ITEM)}: [GridDragDirective]`);
    s.expectError(`${code(GRID_ERROR_CODES.MISSING_GRID_ITEM)}: [GridResizeDirective]`);
    dropElementPayloads(s);

    s.flush();
  });
});
