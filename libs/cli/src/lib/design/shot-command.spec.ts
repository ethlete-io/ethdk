import { describe, expect, it, vi } from 'vitest';
import { designShot, planOf, rowsOf, withDiffRows } from './shot-command';

const base = { product: 'app', part: 'components/button', preset: null, width: null, interaction: null };

describe('planOf', () => {
  it('draws one cell per state in a single row', () => {
    const plan = planOf({
      base,
      rows: [{ label: '', sketch: null }],
      statesOf: () => ['rest', 'busy'],
      states: true,
      state: null,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]?.map((cell) => cell.label)).toEqual(['rest', 'busy']);
    expect(plan[0]?.[1]?.address).toMatchObject({ state: 'busy', sketch: null });
  });

  it('labels a variant by its key alone and draws the first state, or the one asked for', () => {
    const rows = [
      { label: 'a', sketch: { target: 'components/button', variant: 'a' } },
      { label: 'b', sketch: { target: 'components/button', variant: 'b' } },
    ];
    const statesOf = () => ['rest', 'busy'];

    const first = planOf({ base, rows, statesOf, states: false, state: null });
    const asked = planOf({ base, rows, statesOf, states: false, state: 'busy' });

    expect(first.map((row) => row[0]?.label)).toEqual(['a', 'b']);
    expect(first[0]?.[0]?.address).toMatchObject({ state: 'rest', sketch: { variant: 'a' } });
    expect(asked[1]?.[0]?.address.state).toBe('busy');
  });

  it('crosses variants and states, and skips a state a variant lacks', () => {
    const rows = [
      { label: 'a', sketch: { target: 'components/button', variant: 'a' } },
      { label: 'b', sketch: { target: 'components/button', variant: 'b' } },
    ];
    const plan = planOf({
      base,
      rows,
      statesOf: (axis) => (axis.label === 'a' ? ['rest', 'busy'] : ['rest']),
      states: true,
      state: null,
    });

    expect(plan[0]?.map((cell) => cell.label)).toEqual(['a / rest', 'a / busy']);
    expect(plan[1]?.map((cell) => cell.label)).toEqual(['b / rest']);
  });
});

describe('designShot', () => {
  const run = async (argv: string[]) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = await designShot({ target: '/nowhere', argv, invocation: 'et design' });
    const text = error.mock.calls.flat().join('\n');

    error.mockRestore();

    return { code, text };
  };

  it('prints the usage without --states or --variants', async () => {
    const { code, text } = await run(['components/button']);

    expect(code).toBe(2);
    expect(text).toContain('usage: et design shot <layer>/<name> --states');
  });

  it('rejects a preset together with a width, and a bad width', async () => {
    expect((await run(['components/button', '--states', '--preset', 'phone', '--width', '300'])).code).toBe(2);
    expect((await run(['components/button', '--states', '--width', 'wide'])).code).toBe(2);
  });

  it('says so when the checkout has no design config', async () => {
    const { code, text } = await run(['components/button', '--states']);

    expect(code).toBe(1);
    expect(text).toContain('no config at');
  });
});

describe('rowsOf', () => {
  it('draws the merged state as the first row of a variants sheet', () => {
    const rows = rowsOf({ part: 'pages/a', variants: ['one', 'two'], merged: true });

    expect(rows.map((row) => row.label)).toEqual(['merged', 'one', 'two']);
    expect(rows[0]?.sketch).toBeNull();
  });

  it('draws only the variants when the part is not merged yet', () => {
    expect(rowsOf({ part: 'pages/a', variants: ['one'], merged: false }).map((row) => row.label)).toEqual(['one']);
  });
});

describe('withDiffRows', () => {
  it('adds a row after each variant row that compares each state with the merged one', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a', 'b'], merged: true });
    const plan = planOf({
      base,
      rows,
      statesOf: (axis) => (axis.label === 'b' ? ['rest', 'new'] : ['rest']),
      states: true,
      state: null,
    });
    const png = (text: string) => Buffer.from(text);
    const sheet = [
      [{ label: 'merged / rest', png: png('m') }],
      [{ label: 'a / rest', png: png('a') }],
      [
        { label: 'b / rest', error: 'boom' },
        { label: 'b / new', png: png('b') },
      ],
    ];

    expect(withDiffRows({ rows, plan, sheet })).toEqual([
      sheet[0],
      sheet[1],
      [{ label: 'a / rest vs merged', before: png('m'), after: png('a'), over: 'a / rest' }],
      sheet[2],
    ]);
  });

  it('leaves a sheet without a merged row as it is', () => {
    const rows = rowsOf({ part: 'components/button', variants: ['a'], merged: false });
    const plan = planOf({ base, rows, statesOf: () => ['rest'], states: true, state: null });
    const sheet = [[{ label: 'a / rest', png: Buffer.from('a') }]];

    expect(withDiffRows({ rows, plan, sheet })).toBe(sheet);
  });
});
