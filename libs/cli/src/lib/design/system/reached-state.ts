import { PixelCompare } from './part-compare';

/**
 * What an app drawing that missed `goal` reached instead: the declared state it matches exactly, or the closest one by
 * differing pixels. `compare` compares the app drawing with one state's design; a state it fails to draw is skipped.
 */
export const reachedStateOf = async (options: {
  goal: string;
  states: readonly string[];
  compare: (state: string) => Promise<PixelCompare | null>;
}) => {
  const { goal, states, compare } = options;
  const compared = await Promise.all(
    states.map(async (state) => ({ state, result: await compare(state).catch(() => null) })),
  );
  const exact = compared.find(({ state, result }) => state !== goal && result?.kind === 'ok');

  if (exact) return `reaches state ${exact.state} instead`;

  const closest = compared
    .flatMap(({ state, result }) => (result?.kind === 'diff' ? [{ state, pixels: result.pixels }] : []))
    .sort((a, b) => a.pixels - b.pixels)[0];

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

    const differing = keys.filter(
      (key) => (after.find((control) => control.key === key)?.expanded ?? 'absent') !== expected[key],
    ).length;

    return [{ state, differing }];
  });
  const exact = compared.filter(({ state, differing }) => state !== goal && differing === 0).map(({ state }) => state);

  if (exact.length > 0) return `reaches state ${exact.join(' or ')} instead`;

  const closest = compared.sort((a, b) => a.differing - b.differing)[0];

  return closest
    ? `reaches no declared state (closest ${closest.state}, ${closest.differing} control${closest.differing === 1 ? ' differs' : 's differ'})`
    : 'reaches no declared state';
};
