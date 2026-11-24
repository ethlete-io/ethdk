import { gridScaleOf, interactionGridOf } from './interaction-grid';

describe('interactionGridOf', () => {
  it('puts the title card states on one line per base and one column per interaction', () => {
    const grid = interactionGridOf([
      'default',
      'default-hover',
      'default-focus-visible',
      'series',
      'series-hover',
      'fallback',
    ]);

    expect(grid).toEqual({
      interactions: ['rest', 'hover', 'focus-visible'],
      lines: [
        { base: 'default', states: ['default', 'default-hover', 'default-focus-visible'] },
        { base: 'series', states: ['series', 'series-hover', null] },
        { base: 'fallback', states: ['fallback', null, null] },
      ],
    });
  });

  it('draws no grid when no state names an interaction', () => {
    expect(interactionGridOf(['mark', 'misuse'])).toBeNull();
  });
});

describe('gridScaleOf', () => {
  it('fits every variant column into the room at one positive scale', () => {
    const scale = gridScaleOf({ room: 1000, columns: [111, 111, 111, 111], heads: [30, 40, 45, 95] });
    const width = 4 * [30, 40, 45, 95].reduce((sum, head) => sum + Math.max(111 * scale, head), 0);

    expect(scale).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(1000);
    expect(width).toBeGreaterThan(990);
  });

  it('keeps the natural size when everything fits', () => {
    expect(gridScaleOf({ room: 5000, columns: [264, 264], heads: [30, 40, 95] })).toBe(1);
  });
});
