import { describe, expect, it } from 'vitest';
import { sheetLayoutOf, sheetMarkupOf } from '../../../design/web/frame-sheet';

describe('sheetLayoutOf', () => {
  it('lays out the grid rows, then each state the grid leaves out with only its first column', () => {
    const layout = sheetLayoutOf(['primary', 'primary-hover', 'ghost', 'small'], {
      columns: ['rest', 'hover'],
      rows: { primary: { rest: 'primary', hover: 'primary-hover' }, ghost: { rest: 'ghost' } },
    });

    expect(layout).toEqual({
      columns: ['rest', 'hover'],
      rows: [
        { label: 'primary', cells: ['primary', 'primary-hover'] },
        { label: 'ghost', cells: ['ghost', null] },
        { label: 'small', cells: ['small', null] },
      ],
    });
  });

  it('draws every state as its own row under rest without a grid', () => {
    expect(sheetLayoutOf(['a', 'b'])).toEqual({
      columns: ['rest'],
      rows: [
        { label: 'a', cells: ['a'] },
        { label: 'b', cells: ['b'] },
      ],
    });
  });

  it('leaves out a grid cell that names no state of the part', () => {
    expect(
      sheetLayoutOf(['a'], { columns: ['rest'], rows: { a: { rest: 'a' }, gone: { rest: 'gone' } } }).rows,
    ).toEqual([{ label: 'a', cells: ['a'] }]);
  });
});

describe('sheetMarkupOf', () => {
  it('names each row once on the left and each column once on top', () => {
    const markup = sheetMarkupOf(
      { columns: ['rest', 'hover'], rows: [{ label: 'a<b', cells: ['a', null] }] },
      { a: '<button>A</button>' },
    );

    expect(markup).toBe(
      '<table class="et-design-sheet"><thead><tr><th></th><th scope="col">rest</th><th scope="col">hover</th></tr></thead>' +
        '<tbody><tr><th scope="row">a&lt;b</th><td data-et-sheet-state="a"><button>A</button></td><td></td></tr></tbody></table>',
    );
  });
});
