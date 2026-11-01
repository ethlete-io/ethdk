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
