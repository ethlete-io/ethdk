import { gridScaleOf, interactionGridOf, variantsStackedOf } from './interaction-grid';

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

describe('variantsStackedOf', () => {
  it('stacks the tomflix button variants, which side by side draw at 29 % in 1440 px', () => {
    const button = { room: 776, columns: [111, 183, 173, 207], heads: [28, 35, 42, 49] };

    expect(gridScaleOf(button)).toBeLessThan(0.3);
    expect(variantsStackedOf(button)).toBe(true);
  });

  it('keeps the tomflix title card variants side by side at 48 % in 1440 px', () => {
    const titleCard = { room: 880, columns: [264, 384, 264], heads: [28, 35] };

    expect(gridScaleOf(titleCard)).toBeGreaterThan(0.48);
    expect(variantsStackedOf(titleCard)).toBe(false);
  });

  it('stacks two zoom chip variants whose 8 columns at the 160 px floor would run past the list', () => {
    const chip = { room: 1040, columns: [230, 230], heads: [28, 35, 42, 49], minColumn: 160 };

    expect(gridScaleOf(chip)).toBeGreaterThan(0.45);
    expect(variantsStackedOf(chip)).toBe(true);
  });

  it('never stacks a single variant', () => {
    expect(variantsStackedOf({ room: 100, columns: [400], heads: [30] })).toBe(false);
  });
});
