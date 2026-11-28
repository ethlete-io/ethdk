import { describe, expect, it } from 'vitest';
import { aktuellPlaceholderWarningOf, unchangedVariantWarningOf } from './aktuell-placeholders';

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

describe('unchangedVariantWarningOf', () => {
  it('warns when every state draws like Aktuell, as zoom-chip variant a did', () => {
    expect(unchangedVariantWarningOf({ states: ['default', 'zoomed'], unchanged: ['default', 'zoomed'] })).toBe(
      'WARNING VARIANT-UNCHANGED every state (default, zoomed) draws the same pixels as Aktuell - the variant offers no decision',
    );
  });

  it('is silent once one state differs', () => {
    expect(unchangedVariantWarningOf({ states: ['default', 'zoomed'], unchanged: ['default'] })).toBeNull();
  });

  it('is silent for a variant without states', () => {
    expect(unchangedVariantWarningOf({ states: [], unchanged: [] })).toBeNull();
  });
});
