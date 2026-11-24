import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { interactionRepeatMessageOf, repeatedInteractionsOf } from './interaction-repeat';

const ROWS = ['default', 'series', 'fallback'] as const;
const INTERACTIONS = ['hover', 'focus-visible'] as const;

const drawn = (state: string) =>
  readFileSync(resolve(__dirname, '__fixtures__/title-card-rows', `${state}.html`), 'utf8');

const titleCard = (options: { body?: (state: string) => string; styles?: string } = {}) => ({
  states: Object.fromEntries(
    ROWS.flatMap((row) => [
      [row, { state: row }],
      ...INTERACTIONS.map((each) => [`${row}-${each}`, { state: `${row}-${each}` }]),
    ]),
  ),
  grid: {
    columns: ['rest', ...INTERACTIONS],
    rows: Object.fromEntries(
      ROWS.map((row) => [
        row,
        { rest: row, ...Object.fromEntries(INTERACTIONS.map((each) => [each, `${row}-${each}`])) },
      ]),
    ),
  },
  render: ({ state }: { state: string }) => ({ body: (options.body ?? drawn)(state), styles: options.styles ?? '' }),
});

describe('repeatedInteractionsOf', () => {
  it('refuses the hover and focus of the tomflix title card content rows, never of the base row', async () => {
    const found = await repeatedInteractionsOf(titleCard());

    expect(found).toEqual([
      {
        row: 'series',
        baseRow: 'default',
        states: ['series-hover', 'series-focus-visible'],
        interactions: ['hover', 'focus-visible'],
      },
      {
        row: 'fallback',
        baseRow: 'default',
        states: ['fallback-hover', 'fallback-focus-visible'],
        interactions: ['hover', 'focus-visible'],
      },
    ]);
    expect(found.flatMap((each) => each.states).filter((state) => state.startsWith('default'))).toEqual([]);
    expect(interactionRepeatMessageOf(found[0] as (typeof found)[number])).toBe(
      'row "series" draws hover, focus-visible as the base row "default" does and only changes content: draw ' +
        '"series" only at rest - drop series-hover, series-focus-visible (with interactionRows, add "series" to ' +
        'restOnly); its interactions are drawn once, on "default"',
    );
  });

  it('keeps a row whose card itself looks different', async () => {
    const styled = (state: string) =>
      state.startsWith('series')
        ? drawn(state).replace('class="tf-title-card ', 'class="tf-title-card tf-title-card-wide ')
        : drawn(state);

    expect((await repeatedInteractionsOf(titleCard({ body: styled }))).map((each) => each.row)).toEqual(['fallback']);
  });

  it('keeps a row whose own content reacts to the interaction', async () => {
    const reacting = (state: string) =>
      state.startsWith('series')
        ? drawn(state).replace('rounded-full px-2', 'rounded-full group-hover:opacity-100 px-2')
        : drawn(state);

    expect((await repeatedInteractionsOf(titleCard({ body: reacting }))).map((each) => each.row)).toEqual(['fallback']);
  });

  it('keeps every row of a part without a grid', async () => {
    expect(await repeatedInteractionsOf({ ...titleCard(), grid: undefined })).toEqual([]);
  });
});
