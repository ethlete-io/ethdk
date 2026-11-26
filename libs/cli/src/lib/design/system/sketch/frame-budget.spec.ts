import { describe, expect, it } from 'vitest';
import { frameBudgetWarningsOf } from './frame-budget';

const framesOf = (target: string, part: string, variants: string[], states: number, sizes: string[]) =>
  variants.flatMap((variant) =>
    Array.from({ length: states }, (_, index) =>
      sizes.map((size) => ({ sketch: { target, variant }, part, state: `s${index}`, size })),
    ).flat(),
  );

describe('frameBudgetWarningsOf', () => {
  it('warns about a sketch of 3 variants x 25 states at one width', () => {
    expect(
      frameBudgetWarningsOf({
        drawn: framesOf('pages/sketches', 'pages/sketches', ['a', 'b', 'c'], 25, ['1440']),
        targets: [{ target: 'pages/sketches', part: 'pages/sketches' }],
      }),
    ).toEqual([
      'pages/sketches: WARNING 75 frames (3 variants x 25 states x 1 widths) pass the budget of 24; Studio opens them all when no state folds as unchanged',
    ]);
  });

  it('counts only the target part, so affected parts and a small sketch stay quiet', () => {
    expect(
      frameBudgetWarningsOf({
        drawn: [
          ...framesOf('components/card', 'components/card', ['a', 'b'], 4, ['320', '1024']),
          ...framesOf('components/card', 'pages/start', ['a', 'b'], 30, ['1440']),
        ],
        targets: [{ target: 'components/card', part: 'components/card' }],
      }),
    ).toEqual([]);
  });
});
