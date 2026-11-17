import { dirname } from 'path';
import { changedStatesOf, readPictures } from './accepted-pictures';
import { partOwnerOf } from './inventory-approval';
import { createPartPictureCache, PartPictureCache } from './part-picture-cache';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { readMerged } from './sketch/merged-parts';

/** The states of `states` a problem is placed at: its `at` names the state, alone or ahead of a space or colon, or its message names `state "<state>"`. */
export const problemStatesOf = (
  states: readonly string[],
  problems: readonly Pick<Problem, 'at' | 'message'>[],
): string[] =>
  states.filter((state) =>
    problems.some(
      ({ at, message }) =>
        at === state ||
        at?.startsWith(`${state} `) ||
        at?.startsWith(`${state}:`) ||
        message.includes(`state "${state}"`),
    ),
  );

/**
 * The states of each part whose picture differs from the one its last sketch merge accepted, under the part key. Only
 * a part changed since that merge whose current pictures were drawn already has an entry: nothing is drawn here.
 */
export const changedStatesSinceMergeOf = (options: {
  target: string;
  product: ResolvedProduct;
  cache?: PartPictureCache;
}): Map<string, string[]> => {
  const { target, product } = options;
  const changed = new Map<string, string[]>();
  const recordsOf = new Map<string, { merged: Record<string, string>; pictures: ReturnType<typeof readPictures> }>();
  let cache = options.cache;

  for (const part of product.parts) {
    const key = partKeyOf(part);
    const owner = partOwnerOf({ product, part });
    const records = recordsOf.get(owner.dir) ?? { merged: readMerged(owner.dir), pictures: readPictures(owner.dir) };

    recordsOf.set(owner.dir, records);

    const merged = records.merged[key];

    if (merged === undefined) continue;

    const hash = partHashOf({ product: owner, dir: dirname(part.file) });

    if (hash === merged) continue;

    cache ??= createPartPictureCache({ target, product });

    const record = records.pictures[key]?.record;
    const before = record?.partHash === merged ? record.states : cache.read(part, merged);
    const now = before ? cache.read(part, hash) : null;
    const states = before && now ? changedStatesOf(before, now).filter((state) => state in now) : [];

    if (states.length > 0) changed.set(key, states);
  }

  return changed;
};
