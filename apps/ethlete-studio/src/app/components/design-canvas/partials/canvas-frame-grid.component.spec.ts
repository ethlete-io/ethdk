import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FrameCell, FrameGrid } from '../canvas-frame';
import { CanvasFrameCellComponent, CanvasFrameGridComponent } from './canvas-frame-grid.component';

const render = async (cell: FrameCell) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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

    it('reveals once a failed image has settled too', async () => {
      const fixture = await renderShots();

      await settle(fixture, 0, 'load');
      await settle(fixture, 1, 'error');
      await settle(fixture, 2, 'load');

      expect(fixture.nativeElement.querySelector('.invisible')).toBeNull();
    });
  });
});
