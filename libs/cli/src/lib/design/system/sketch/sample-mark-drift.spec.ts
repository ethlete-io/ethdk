import { describe, expect, it } from 'vitest';
import { markNamed, markPart } from '../../../../../design/mark-part';
import { sampleMarkDriftLineOf, sampleMarkDriftsOf } from './sample-mark-drift';

type CellProps = { sample?: string; state: string; same?: boolean; look?: string; place?: string };

const cellPart = {
  note: 'cell',
  states: {},
  sample: { id: 'sample', marks: ['same', 'look'] },
  render: () => ({ body: '<div></div>', styles: '' }),
};
const cell = markNamed(
  (props: CellProps) =>
    `<div class="${props.same ? 'dim' : ''} ${props.look ?? ''}" style="${props.place ?? ''}"></div>`,
  { key: 'elements/cell', part: cellPart },
);

type PageProps = { steady?: string[]; place?: string; other?: string[]; unnamed?: boolean };

const page = (states: Record<string, PageProps>) =>
  markPart(
    {
      note: 'page',
      states,
      render: async ({ steady = [], place = '', other = [], unnamed = false }: PageProps) => ({
        body: ['rest', 'hover']
          .map((state) =>
            cell({
              sample: unnamed ? undefined : `a ${state}${other.includes(state) ? ' unchanged' : ''}`,
              state,
              same: steady.includes(state) || other.includes(state),
              look: steady.includes(state) || other.includes(state) ? '' : 'rounded',
              place,
            }),
          )
          .join(''),
        styles: '',
      }),
    },
    'pages/page',
  );

describe('sampleMarkDriftsOf', () => {
  it('finds a sample whose marks differ between two states of the host', async () => {
    const drifts = await sampleMarkDriftsOf(page({ narrow: {}, merged: { steady: ['hover'] } }));

    expect(drifts.map(sampleMarkDriftLineOf)).toEqual([
      'elements/cell "a hover" draws same=false look="rounded" in narrow but same=true look="" in merged - give it the same marks in every state, or another id where the state shows another sample',
    ]);
  });

  it('passes when every state draws each sample with the same marks, whatever else differs', async () => {
    expect(await sampleMarkDriftsOf(page({ narrow: {}, wide: { place: 'grid-column: 2' } }))).toEqual([]);
  });

  it('passes when a state names another sample with its own id', async () => {
    expect(await sampleMarkDriftsOf(page({ narrow: {}, unchanged: { other: ['hover'] } }))).toEqual([]);
  });

  it('ignores instances without an id', async () => {
    expect(
      await sampleMarkDriftsOf(page({ narrow: { unnamed: true }, merged: { unnamed: true, steady: ['hover'] } })),
    ).toEqual([]);
  });

  it('records nothing once the check is done', async () => {
    await sampleMarkDriftsOf(page({ narrow: {} }));

    expect(Object.getOwnPropertySymbols(globalThis).some((symbol) => symbol.description?.includes('samples'))).toBe(
      false,
    );
  });
});
