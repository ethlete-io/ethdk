import { describe, expect, it } from 'vitest';
import { aktuellPlaceholderWarningOf } from './aktuell-placeholders';

const unchanged = ['default', 'hover', 'active', 'focus', 'disabled'];

describe('aktuellPlaceholderWarningOf', () => {
  it('warns when only new states remain visible, as in the pages-system sketch', () => {
    const states = [...unchanged, 'tree', 'detail'];

    expect(
      aktuellPlaceholderWarningOf({
        current: unchanged,
        variants: [
          { states, unchanged },
          { states, unchanged },
        ],
      }),
    ).toBe('Aktuell shows only placeholders: open "default" to compare');
  });

  it('is silent once a visible state exists in the product', () => {
    expect(
      aktuellPlaceholderWarningOf({
        current: unchanged,
        variants: [{ states: [...unchanged, 'tree'], unchanged: unchanged.slice(1) }],
      }),
    ).toBeNull();
  });

  it('is silent when nothing is folded', () => {
    expect(aktuellPlaceholderWarningOf({ current: [], variants: [{ states: ['tree'], unchanged: [] }] })).toBeNull();
  });
});
