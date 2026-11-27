import { CheckoutRoots, repoRootOf } from '../model/context';
import { CollectedEvent } from '../model/event';

const lowerPath = (path: string) => path.replace(/[\\/]+$/, '').toLowerCase();

/**
 * Each checkout whose origin is the local path of another known checkout, mapped to that checkout.
 * `keys` holds each checkout's own key from `readRepoKey$`, before `resolveLocalOrigins` re-keys it.
 */
export const localClonesOf = (keys: Readonly<Record<string, string>>): Record<string, string> => {
  const byPath = new Map(Object.keys(keys).map((path) => [lowerPath(path), path]));

  return Object.fromEntries(
    Object.entries(keys).flatMap(([path, key]) => {
      const origin = key.startsWith('/') ? byPath.get(lowerPath(key)) : undefined;

      return origin && origin !== path ? [[path, origin]] : [];
    }),
  );
};

/**
 * Each local clone mapped to the known checkout whose agent sessions worked in it most, so a clone an
 * agent made for its own work is drawn as that checkout's work. A clone no session started elsewhere
 * worked in, or one two checkouts tie on, is left out.
 */
export const cloneOwnersOf = (options: {
  events: readonly CollectedEvent[];
  clones: Readonly<Record<string, string>>;
  roots: CheckoutRoots;
}): Record<string, string> => {
  const known = new Set(options.roots.paths);
  const counts = new Map<string, Map<string, number>>();

  for (const event of options.events) {
    if (event.kind !== 'agent-session' || !event.workedIn) continue;

    const clone = repoRootOf({ path: event.workedIn, roots: options.roots });
    const owner = repoRootOf({ path: event.cwd, roots: options.roots });

    if (options.clones[clone] === undefined || owner === clone) continue;
    if (!known.has(owner) || options.clones[owner] !== undefined) continue;

    const byOwner = counts.get(clone) ?? new Map<string, number>();
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + 1);
    counts.set(clone, byOwner);
  }

  return Object.fromEntries(
    [...counts].flatMap(([clone, byOwner]) => {
      const [first, second] = [...byOwner].sort(([, a], [, b]) => b - a);

      return first && first[1] !== second?.[1] ? [[clone, first[0]]] : [];
    }),
  );
};
