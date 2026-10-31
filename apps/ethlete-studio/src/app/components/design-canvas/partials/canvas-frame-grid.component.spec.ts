import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { vi } from 'vitest';
import { THEMES } from '../../../../themes';
import { FrameCell, FrameGrid } from '../canvas-frame';
import {
  CanvasFrameCellComponent,
  CanvasFrameGridComponent,
  LIVE_REVEAL_TIMEOUT_MS,
} from './canvas-frame-grid.component';
import { SLOW_SHOT_MS } from './shot-state';

const render = async (cell: FrameCell) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(CanvasFrameCellComponent);

  fixture.componentRef.setInput('cell', cell);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

describe('CanvasFrameCellComponent', () => {
  it('takes the width a cell names before its page reports a size', async () => {
    const host = await render({ id: 'leaf 280', row: 'leaf', column: 'rest', label: 'leaf', src: '', width: 280 });

    expect(host.style.width).toBe('280px');
  });

  it('waits for the size its page reports without a width', async () => {
    const host = await render({ id: 'leaf', row: 'leaf', column: 'rest', label: 'leaf', src: '' });

    expect(host.style.width).toBe('0px');
  });

  describe('swap between shot and page', () => {
    let decoded: () => void;
    let fixture: ComponentFixture<CanvasFrameCellComponent>;

    const flush = async () => {
      for (let tick = 0; tick < 4; tick++) await new Promise((resolve) => setTimeout(resolve, 0));
      await fixture.whenStable();
    };

    const post = (data: object) =>
      window.dispatchEvent(
        new MessageEvent('message', { source: fixture.nativeElement.querySelector('iframe').contentWindow, data }),
      );

    const shown = () => {
      const host = fixture.nativeElement as HTMLElement;
      const image = host.querySelector('img');
      const iframe = host.querySelector('iframe');

      return {
        shot: !!image && !image.classList.contains('opacity-0'),
        page: !!iframe && !iframe.classList.contains('opacity-0'),
        mounted: !!iframe,
      };
    };

    beforeEach(async () => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: () => new Promise<void>((resolve) => (decoded = resolve)),
      });
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
      });
      fixture = TestBed.createComponent(CanvasFrameCellComponent);
      fixture.componentRef.setInput('cell', {
        id: 'leaf',
        row: 'leaf',
        column: 'rest',
        label: 'leaf',
        src: '',
        screenshot: 'leaf.png',
      });
      fixture.componentRef.setInput('live', true);
      await flush();
    });

    afterEach(() => {
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      vi.restoreAllMocks();
    });

    it('keeps the shot until the page says it painted, then shows the page in one step', async () => {
      post({ type: 'design-explore:height', height: 120, width: 200 });
      await flush();

      expect(shown()).toEqual({ shot: true, page: false, mounted: true });

      post({ type: 'design-explore:painted' });
      await flush();

      expect(shown()).toEqual({ shot: false, page: true, mounted: true });
    });

    it('keeps the page after it leaves live until the shot decoded, then shows the shot in one step', async () => {
      post({ type: 'design-explore:height', height: 120, width: 200 });
      post({ type: 'design-explore:painted' });
      await flush();
      fixture.componentRef.setInput('live', false);
      await flush();

      expect(shown()).toEqual({ shot: false, page: true, mounted: true });

      decoded();
      await flush();

      expect(shown()).toEqual({ shot: true, page: false, mounted: false });
    });
  });
});

const cellAt = (row: string, column: string): FrameCell => ({
  id: `${row} ${column}`,
  row,
  column,
  label: row,
  src: '',
  width: 280,
});

const renderGrid = async (grid: FrameGrid) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(CanvasFrameGridComponent);

  fixture.componentRef.setInput('grid', grid);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

const textsOf = (host: HTMLElement, selector: string) =>
  [...host.querySelectorAll(selector)].map((element) => element.textContent?.trim());

describe('CanvasFrameGridComponent', () => {
  const columns = ['rest', 'hover', 'active'];
  const rows = ['leaf', 'selected', 'group', 'part', 'inert', 'mark'];
  const cells = [
    cellAt('leaf', 'rest'),
    cellAt('leaf', 'hover'),
    cellAt('selected', 'active'),
    ...['group', 'part', 'inert', 'mark'].map((row) => cellAt(row, 'rest')),
  ];

  it('splits a sheet into the rows that use more than rest and the rest-only rows, packed a line per column count', async () => {
    const host = await renderGrid({ columns, rows, cells, sheet: 'groups' });

    expect(textsOf(host, '[data-grid-group]')).toEqual(['States by interaction', 'Rest only']);
    expect(textsOf(host, '[data-grid-column]')).toEqual(columns);
    expect(textsOf(host, '[data-grid-row]')).toEqual(rows);
    expect(host.querySelectorAll('[data-grid-cell]')).toHaveLength(2 * columns.length + 4);
    expect([...host.querySelectorAll('[data-cell-id]')].map((cell) => cell.getAttribute('data-cell-id'))).toEqual(
      cells.map((cell) => cell.id),
    );
  });

  it('leaves out a group no row falls into', async () => {
    const host = await renderGrid({ columns, rows: ['inert'], cells: [cellAt('inert', 'rest')], sheet: 'groups' });

    expect(textsOf(host, '[data-grid-group]')).toEqual(['Rest only']);
  });

  it('keeps every row of a table sheet in the interaction table, each cell centred', async () => {
    const host = await renderGrid({ columns, rows, cells, sheet: 'table' });

    expect(textsOf(host, '[data-grid-group]')).toEqual(['States by interaction']);
    expect(textsOf(host, '[data-grid-row]')).toEqual(rows);
    expect(host.querySelectorAll('[data-grid-cell]')).toHaveLength(rows.length * columns.length);
    expect(host.querySelector('[data-grid-cell]')?.classList).toContain('place-items-center');
  });

  it('leaves out the group of a table sheet without rows', async () => {
    const host = await renderGrid({ columns, rows: [], cells: [], sheet: 'table' });

    expect(host.querySelector('[data-grid-sheet]')).not.toBeNull();
    expect(host.querySelectorAll('[data-grid-group]')).toHaveLength(0);
  });

  it('pads a sheet cell more along the block axis than along the inline axis', async () => {
    const host = await renderGrid({ columns, rows, cells, sheet: 'groups' });

    expect(
      [...host.querySelectorAll('[data-grid-cell]')].every(
        (cell) => cell.classList.contains('py-space-2') && cell.classList.contains('px-space-1'),
      ),
    ).toBe(true);
    expect(host.querySelector('[data-grid-cell]')?.classList).not.toContain('place-items-center');
  });

  it('marks each empty column of a row that draws a state as not drawn, and no cell of a row that draws none', async () => {
    const host = await renderGrid({ columns, rows: [...rows, 'unused'], cells, sheet: 'table' });

    expect(host.querySelectorAll('[data-grid-empty]')).toHaveLength(rows.length * columns.length - cells.length);
    expect(textsOf(host, '[data-grid-empty]').every((text) => text === 'not drawn')).toBe(true);
  });

  it('marks the empty cells of the interaction table in a groups sheet only', async () => {
    const host = await renderGrid({ columns, rows, cells, sheet: 'groups' });

    expect(host.querySelectorAll('[data-grid-empty]')).toHaveLength(3);
  });

  it('marks the empty cells of a plain table', async () => {
    const host = await renderGrid({ columns, rows, cells });

    expect(host.querySelectorAll('[data-grid-empty]')).toHaveLength(rows.length * columns.length - cells.length);
  });

  it('draws a grid without sheet as the plain table', async () => {
    const host = await renderGrid({ columns, rows, cells });

    expect(host.querySelector('[data-grid-sheet]')).toBeNull();
    expect(host.querySelectorAll('[data-grid-group], [data-grid-cell]')).toHaveLength(0);
    expect(textsOf(host, '[data-grid-row]')).toEqual(rows);
  });

  describe('colour schemes', () => {
    const port = 'http://localhost:1';
    const schemed = (cell: FrameCell): FrameCell => ({
      ...cell,
      src: `${port}/frame.html?part=p&state=${cell.row}`,
      screenshot: `${port}/__design/shot?part=p&state=${cell.row}&scheme=dark&priority=low`,
    });
    const grid = (sheet?: FrameGrid['sheet']): FrameGrid => ({
      columns,
      rows,
      cells: cells.map(schemed),
      schemes: ['light', 'dark'],
      ...(sheet ? { sheet } : {}),
    });
    const urlsOf = (host: HTMLElement, selector: string, attribute: string) =>
      [...host.querySelectorAll(selector)].map((element) => element.getAttribute(attribute) ?? '');

    it.each([undefined, 'groups', 'table'] as const)(
      'draws every column once per scheme under a Light and a Dark head (sheet %s)',
      async (sheet) => {
        const host = await renderGrid(grid(sheet));

        expect(textsOf(host, '[data-grid-scheme]').slice(0, 2)).toEqual(['Light', 'Dark']);
        expect(textsOf(host, '[data-grid-column]')).toEqual([...columns, ...columns]);
        expect(host.querySelectorAll('[data-cell-scheme="light"]')).toHaveLength(cells.length);
        expect(host.querySelectorAll('[data-cell-scheme="dark"]')).toHaveLength(cells.length);
      },
    );

    it('asks each group for the shots of its own scheme', async () => {
      const host = await renderGrid(grid());
      const shots = urlsOf(host, 'img', 'src');

      expect(shots.filter((url) => url.includes('scheme=light'))).toHaveLength(cells.length);
      expect(shots.filter((url) => url.includes('scheme=dark'))).toHaveLength(cells.length);
      expect(shots.every((url) => url.split('scheme=').length === 2)).toBe(true);
    });

    it('draws each live cell in the scheme of its group', async () => {
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
      });

      const fixture = TestBed.createComponent(CanvasFrameGridComponent);

      fixture.componentRef.setInput('grid', grid());
      fixture.componentRef.setInput('live', true);
      await fixture.whenStable();

      const host = fixture.nativeElement as HTMLElement;

      expect(urlsOf(host, '[data-cell-scheme="light"] iframe', 'src')).toEqual(
        cells.map((cell) => `${port}/frame.html?part=p&state=${cell.row}&scheme=light`),
      );
      expect(urlsOf(host, '[data-cell-scheme="dark"] iframe', 'src')).toEqual(
        cells.map((cell) => `${port}/frame.html?part=p&state=${cell.row}&scheme=dark`),
      );
    });

    it('waits for the shots of both schemes before it reveals', async () => {
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
      });

      const fixture = TestBed.createComponent(CanvasFrameGridComponent);

      fixture.componentRef.setInput('grid', grid());
      await fixture.whenStable();

      const host = fixture.nativeElement as HTMLElement;
      const images = [...host.querySelectorAll<HTMLImageElement>('[data-cell-scheme="light"] img')];

      images.forEach((image) => image.dispatchEvent(new Event('load')));
      await fixture.whenStable();

      expect(host.querySelector('[data-grid-loading]')).not.toBeNull();

      host.querySelectorAll('[data-cell-scheme="dark"] img').forEach((image) => image.dispatchEvent(new Event('load')));
      await fixture.whenStable();

      expect(host.querySelector('[data-grid-loading]')).toBeNull();
    });
  });

  describe('reveal', () => {
    const shots = cells.slice(0, 3).map((cell) => ({ ...cell, screenshot: `/shot/${cell.id}.png` }));

    const renderShots = async () => {
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
      });

      const fixture = TestBed.createComponent(CanvasFrameGridComponent);

      fixture.componentRef.setInput('grid', { columns, rows, cells: shots });
      await fixture.whenStable();

      return fixture;
    };

    const settle = async (fixture: Awaited<ReturnType<typeof renderShots>>, index: number, type: 'load' | 'error') => {
      fixture.nativeElement.querySelectorAll('img')[index].dispatchEvent(new Event(type));
      await fixture.whenStable();
    };

    it('hides the cells and shows the loading state until every image has loaded', async () => {
      const fixture = await renderShots();
      const host = fixture.nativeElement as HTMLElement;

      await settle(fixture, 0, 'load');
      await settle(fixture, 1, 'load');

      expect(host.querySelector('[data-grid-loading]')).not.toBeNull();
      expect(host.querySelector('.invisible')).not.toBeNull();

      await settle(fixture, 2, 'load');

      expect(host.querySelector('[data-grid-loading]')).toBeNull();
      expect(host.querySelector('.invisible')).toBeNull();
    });

    it('stays revealed while the shots of an edited part load, and hides again for a new cell', async () => {
      const fixture = await renderShots();
      const host = fixture.nativeElement as HTMLElement;

      await settle(fixture, 0, 'load');
      await settle(fixture, 1, 'load');
      await settle(fixture, 2, 'load');

      fixture.componentRef.setInput('grid', {
        columns,
        rows,
        cells: shots.map((cell) => ({ ...cell, screenshot: `${cell.screenshot}?revision=1` })),
      });
      await fixture.whenStable();

      expect(host.querySelector('[data-grid-loading]')).toBeNull();
      expect(host.querySelector('.invisible')).toBeNull();

      fixture.componentRef.setInput('grid', {
        columns,
        rows,
        cells: [...shots, { ...cellAt('group', 'rest'), screenshot: '/shot/group rest.png' }],
      });
      await fixture.whenStable();

      expect(host.querySelector('.invisible')).not.toBeNull();
    });

    it('reveals once a failed image has settled too', async () => {
      const fixture = await renderShots();

      await settle(fixture, 0, 'load');
      await settle(fixture, 1, 'error');
      await settle(fixture, 2, 'load');

      expect(fixture.nativeElement.querySelector('.invisible')).toBeNull();
    });

    it('shows a failed shot as an error in its cell', async () => {
      const fixture = await renderShots();
      const host = fixture.nativeElement as HTMLElement;

      await settle(fixture, 0, 'load');
      await settle(fixture, 1, 'error');

      const failed = host.querySelectorAll('ethlete-canvas-frame-cell')[1];

      expect(failed?.querySelector('[data-shot-failed]')?.textContent).toContain('Render failed');
      expect(host.querySelectorAll('[data-shot-failed]').length).toBe(1);
    });

    it('marks a cell whose shot takes long as rendering until it loads', async () => {
      vi.useFakeTimers();

      try {
        TestBed.configureTestingModule({
          providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
        });

        const fixture = TestBed.createComponent(CanvasFrameGridComponent);
        const host = fixture.nativeElement as HTMLElement;
        const flush = (ms: number) => vi.advanceTimersByTimeAsync(ms);

        fixture.componentRef.setInput('grid', { columns, rows, cells: shots });
        await flush(1000);

        expect(host.querySelectorAll('[data-shot-slow]').length).toBe(0);

        await flush(1500);

        expect(host.querySelectorAll('[data-shot-slow]').length).toBe(3);

        host.querySelectorAll('img')[0]?.dispatchEvent(new Event('load'));
        await flush(20);

        expect(host.querySelectorAll('[data-shot-slow]').length).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reveals with the slow mark once a shot that never answers turns slow', async () => {
      vi.useFakeTimers();

      try {
        TestBed.configureTestingModule({
          providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
        });

        const fixture = TestBed.createComponent(CanvasFrameGridComponent);
        const host = fixture.nativeElement as HTMLElement;
        const flush = (ms: number) => vi.advanceTimersByTimeAsync(ms);

        fixture.componentRef.setInput('grid', { columns, rows, cells: shots });
        await flush(20);

        host.querySelectorAll('img')[0]?.dispatchEvent(new Event('load'));
        host.querySelectorAll('img')[1]?.dispatchEvent(new Event('error'));
        await flush(1000);

        expect(host.querySelector('.invisible')).not.toBeNull();

        await flush(SLOW_SHOT_MS);

        const hung = host.querySelectorAll('ethlete-canvas-frame-cell')[2];

        expect(host.querySelector('.invisible')).toBeNull();
        expect(host.querySelector('[data-grid-loading]')).toBeNull();
        expect(hung?.querySelector('[data-shot-slow]')).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('go live', () => {
    const live = cells.slice(0, 2).map((cell) => ({ ...cell, screenshot: `/shot/${cell.id}.png` }));
    let fixture: ComponentFixture<CanvasFrameGridComponent>;

    const flush = async () => {
      for (let tick = 0; tick < 4; tick++) await vi.advanceTimersByTimeAsync(20);
    };

    const paint = async (index: number) => {
      const source = fixture.nativeElement.querySelectorAll('iframe')[index].contentWindow;

      window.dispatchEvent(
        new MessageEvent('message', { source, data: { type: 'design-explore:height', height: 80 } }),
      );
      window.dispatchEvent(new MessageEvent('message', { source, data: { type: 'design-explore:painted' } }));
      await flush();
    };

    const pagesShown = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('ethlete-canvas-frame-cell')].map((cell) => {
        const page = cell.querySelector('iframe');

        return !!page && !page.classList.contains('opacity-0') && !!cell.querySelector('img.opacity-0');
      });

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
      });
      fixture = TestBed.createComponent(CanvasFrameGridComponent);
      fixture.componentRef.setInput('grid', { columns, rows, cells: live });
      fixture.componentRef.setInput('live', true);
      await flush();
    });

    afterEach(() => {
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('keeps every shot until every live cell painted, then shows every page in one step', async () => {
      await paint(0);

      expect(pagesShown()).toEqual([false, false]);

      await paint(1);

      expect(pagesShown()).toEqual([true, true]);
    });

    it('keeps the shots of a grid that leaves live before every cell painted', async () => {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: () => new Promise<void>(() => undefined),
      });
      await paint(0);
      fixture.componentRef.setInput('live', false);
      await flush();

      expect(pagesShown()).toEqual([false, false]);
    });

    it('waits only for the cells that go live', async () => {
      fixture.componentRef.setInput('liveCells', new Set([cellAt('leaf', 'hover').id]));
      await flush();
      await paint(0);

      expect(pagesShown()).toEqual([false, true]);
    });

    it('counts a cell that already shows its page when more cells go live', async () => {
      fixture.componentRef.setInput('liveCells', new Set([cellAt('leaf', 'rest').id]));
      await flush();
      await paint(0);
      fixture.componentRef.setInput('liveCells', null);
      await flush();

      expect(pagesShown()).toEqual([true, false]);

      await paint(1);

      expect(pagesShown()).toEqual([true, true]);
    });

    it('shows the pages that painted once a stuck cell runs out of time, the stuck one keeping its shot', async () => {
      await paint(0);
      await vi.advanceTimersByTimeAsync(LIVE_REVEAL_TIMEOUT_MS / 2);

      expect(pagesShown()).toEqual([false, false]);

      await vi.advanceTimersByTimeAsync(LIVE_REVEAL_TIMEOUT_MS);
      await flush();

      expect(pagesShown()).toEqual([true, false]);
    });
  });
});
