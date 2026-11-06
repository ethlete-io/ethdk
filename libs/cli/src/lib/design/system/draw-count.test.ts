export type DrawKind = 'design' | 'app';

/** Counts the pictures a fake drawer really draws, by kind and picture key; `take` returns the counts so far and starts over. */
export const createDrawCount = () => {
  const counts = new Map<string, number>();

  return {
    drawn: (kind: DrawKind, key: string) => {
      const at = `${kind} ${key}`;

      counts.set(at, (counts.get(at) ?? 0) + 1);
    },
    take: () => {
      const taken = new Map(counts);

      counts.clear();

      return taken;
    },
  };
};

/** One line per picture drawn more than once; a spec expects it empty. */
export const drawnMoreThanOnce = (counts: ReadonlyMap<string, number>) =>
  [...counts].flatMap(([key, count]) => (count > 1 ? [`${key} drawn ${count} times`] : []));
