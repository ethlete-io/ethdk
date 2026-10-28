import { describe, expect, it, vi } from 'vitest';
import { designShot, planOf } from './shot-command';

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
