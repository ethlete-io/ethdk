import { describe, expect, it } from 'vitest';
import { planOf } from './shot-command';
import { unstableCellsOf, unstableReportOf } from './unstable-cells';

const base = { product: 'app', part: 'components/button', preset: null, width: null, interaction: null };

describe('unstableCellsOf', () => {
  const plan = planOf({
    base: { ...base, part: 'pages/merge' },
    rows: [{ label: '', sketch: null }],
    statesOf: () => ['open', 'empty'],
    states: true,
    state: null,
  });
  const cellsOf = (open: string, empty: string) => [
    [
      { label: 'open', png: Buffer.from(open) },
      { label: 'empty', png: Buffer.from(empty) },
    ],
  ];

  it('names each state whose second render differs, with its changed pixels and their box', async () => {
    const unstable = await unstableCellsOf({
      plan,
      first: cellsOf('a', 'same'),
      second: cellsOf('b', 'same'),
      boxOf: async () => [
        { x: 365, y: 454, width: 14, height: 46 },
        { x: 914, y: 454, width: 14, height: 46 },
      ],
      pixelsOf: async () => 3798,
    });

    expect(unstableReportOf(unstable)).toEqual([
      'design-explore: pages/merge state "open" (open) draws differently in two renders: 3798 px differ in 365,454 563x46',
    ]);
  });

  it('reports nothing when both renders draw the same pictures', async () => {
    const unstable = await unstableCellsOf({
      plan,
      first: cellsOf('a', 'b'),
      second: cellsOf('a', 'b'),
      boxOf: async () => [],
      pixelsOf: async () => 0,
    });

    expect(unstable).toEqual([]);
  });
});
