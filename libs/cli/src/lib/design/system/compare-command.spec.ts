import { describe, expect, it } from 'vitest';
import { appShotsOf } from './compare-command';

const designOf = (state: string) => ({ png: Buffer.from(`design ${state}`) });

const shooting = () => {
  let running = 0;
  let most = 0;
  const shoot = async ({ state }: { state: string }) => {
    running++;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, state === 'a' ? 20 : 5));
    running--;

    return { app: Buffer.from(`app ${state}`) };
  };

  return { shoot, most: () => most };
};

describe('appShotsOf', () => {
  const states = ['a', 'b', 'c', 'd', 'e', 'f'];
  const designs = new Map(states.map((state) => [state, designOf(state)]));

  it('shoots several states at once, at most four, and keeps the state order', async () => {
    const { shoot, most } = shooting();

    const shots = await appShotsOf({ states, designs, opens: {}, slotOnly: new Map(), shoot });

    expect(most()).toBeGreaterThan(1);
    expect(most()).toBeLessThanOrEqual(4);
    expect(Array.isArray(shots) && shots.map((shot) => shot.state)).toEqual(states);
    expect(Array.isArray(shots) && shots[0]).toEqual({
      state: 'a',
      design: designOf('a').png,
      app: Buffer.from('app a'),
    });
  });

  it('aborts with a pointer open that is a string before it shoots anything', async () => {
    const shot: string[] = [];

    const result = await appShotsOf({
      states,
      designs,
      opens: { d: 'd opens no surface' },
      slotOnly: new Map(),
      shoot: async ({ state }) => {
        shot.push(state);

        return { app: Buffer.from(state) };
      },
    });

    expect(result).toBe('d opens no surface');
    expect(shot).toEqual([]);
  });

  it('skips a state without a design and keeps a problem in its place', async () => {
    const result = await appShotsOf({
      states: ['a', 'missing', 'b', 'c'],
      designs,
      opens: { missing: 'never reached' },
      slotOnly: new Map([['c', 'a']]),
      shoot: async ({ state }) => (state === 'b' ? { problem: 'b has no input' } : { app: Buffer.from(state) }),
    });

    expect(Array.isArray(result) && result.map((shot) => ('problem' in shot ? shot.problem : shot.state))).toEqual([
      'a',
      'b has no input',
      expect.stringContaining('draws like a'),
    ]);
  });
});
