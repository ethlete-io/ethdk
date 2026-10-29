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
    const host = await renderGrid({ columns, rows, cells, sheet: true });

    expect(textsOf(host, '[data-grid-group]')).toEqual(['States by interaction', 'Rest only']);
    expect(textsOf(host, '[data-grid-column]')).toEqual(columns);
    expect(textsOf(host, '[data-grid-row]')).toEqual(rows);
    expect(host.querySelectorAll('[data-grid-cell]')).toHaveLength(2 * columns.length + 4);
    expect([...host.querySelectorAll('[data-cell-id]')].map((cell) => cell.getAttribute('data-cell-id'))).toEqual(
      cells.map((cell) => cell.id),
    );
  });

  it('leaves out a group no row falls into', async () => {
    const host = await renderGrid({ columns, rows: ['inert'], cells: [cellAt('inert', 'rest')], sheet: true });

    expect(textsOf(host, '[data-grid-group]')).toEqual(['Rest only']);
  });

  it('draws a grid without sheet as the plain table', async () => {
    const host = await renderGrid({ columns, rows, cells });

    expect(host.querySelector('[data-grid-sheet]')).toBeNull();
    expect(host.querySelectorAll('[data-grid-group], [data-grid-cell]')).toHaveLength(0);
    expect(textsOf(host, '[data-grid-row]')).toEqual(rows);
  });
});
