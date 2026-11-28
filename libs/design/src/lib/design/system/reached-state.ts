import { PixelCompare } from './part-compare';

/** The `aria-expanded` of the control of `key` that has one, so a plain button sharing its name does not hide it. */
export const expandedOf = (after: readonly { key: string; expanded: string | null }[], key: string) =>
  after.find((control) => control.key === key && control.expanded !== null)?.expanded ?? 'absent';

/**
 * What an app drawing that missed `goal` pixel for pixel reached instead: the declared state it matches exactly, or the
 * closest one by differing pixels. `null` when `goal` is strictly closer than every other state it compared: pixels all
 * states share, such as sample data, differ alike from each, so the ranking counts only what the states change.
 * `compare` compares the app drawing with one state's design; a state it fails to draw is skipped. With `apart`, the
 * pixels two states' designs differ by, `null` also when each state at least as close as `goal` is closer by less than
 * half of what its design differs from `goal`'s: sample data the app draws in place of the design's outweighs the change.
 */
export const reachedStateOf = async (options: {
  goal: string;
  states: readonly string[];
  compare: (state: string) => Promise<PixelCompare | null>;
  apart?: (goal: string, state: string) => Promise<PixelCompare | null>;
}): Promise<string | null> => {
  const { goal, states, compare, apart } = options;
  const compared = await Promise.all(
    states.map(async (state) => ({ state, result: await compare(state).catch(() => null) })),
  );
  const exact = compared.find(({ state, result }) => state !== goal && result?.kind === 'ok');

  if (exact) return `reaches state ${exact.state} instead`;

  const ranked = compared
    .flatMap(({ state, result }) => (result?.kind === 'diff' ? [{ state, pixels: result.pixels }] : []))
    .sort((a, b) => a.pixels - b.pixels);
  const [closest, next] = ranked;

  if (closest?.state === goal && next && closest.pixels < next.pixels) return null;

  const reachedGoal = ranked.find(({ state }) => state === goal);
  const rivals = ranked.filter(({ state, pixels }) => state !== goal && reachedGoal && pixels <= reachedGoal.pixels);

  if (apart && reachedGoal && rivals.length > 0) {
    const outweighed = await Promise.all(
      rivals.map(async ({ state, pixels }) => {
        const between = await apart(goal, state).catch(() => null);

        return between?.kind === 'diff' && (reachedGoal.pixels - pixels) * 2 < between.pixels;
      }),
    );

    if (outweighed.every(Boolean)) return null;
  }

  return closest
    ? `reaches no declared state (closest ${closest.state}, ${closest.pixels} px)`
    : 'reaches no declared state';
};

/**
 * What a live page that missed `goal` reached instead, read from its `aria-expanded` controls: the declared states whose
 * drawn controls it all shows, or the closest one by differing controls. A state that draws none is never reached.
 */
export const reachedExpandedStateOf = async (options: {
  goal: string;
  states: readonly string[];
  expectedOf: (state: string) => Promise<Record<string, string>>;
  after: readonly { key: string; expanded: string | null }[];
}) => {
  const { goal, states, expectedOf, after } = options;
  const compared = (
    await Promise.all(states.map(async (state) => ({ state, expected: await expectedOf(state).catch(() => null) })))
  ).flatMap(({ state, expected }) => {
    const keys = Object.keys(expected ?? {});

    if (!expected || keys.length === 0) return [];

    const differing = keys.filter((key) => expandedOf(after, key) !== expected[key]).length;

    return [{ state, differing }];
  });
  const exact = compared.filter(({ state, differing }) => state !== goal && differing === 0).map(({ state }) => state);

  if (exact.length > 0) return `reaches state ${exact.join(' or ')} instead`;

  const closest = compared.sort((a, b) => a.differing - b.differing)[0];

  return closest
    ? `reaches no declared state (closest ${closest.state}, ${closest.differing} control${closest.differing === 1 ? ' differs' : 's differ'})`
    : 'reaches no declared state';
};
