import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashOf } from './baseline';
import { listSketches, variantDirOf } from './sketch';

export const MERGED_FILE = 'merged.json';

const mergedFileOf = (productDir: string) => resolve(productDir, MERGED_FILE);

/** The content hash of each part, its folder and the assets it imports, as its last sketch merge left it, under the part key. */
export const readMerged = (productDir: string): Record<string, string> => {
  const file = mergedFileOf(productDir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      : {};
  } catch {
    return {};
  }
};

type HashedProduct = Pick<ResolvedProduct, 'dir' | 'base'> & Partial<Pick<ResolvedProduct, 'config'>>;

/** Records the current content hash of each named part of the product as merged. */
export const recordMerged = (options: { product: HashedProduct; parts: string[] }) => {
  const { product, parts } = options;
  const productDir = product.dir;
  const merged = readMerged(productDir);

  for (const part of parts) merged[part] = partHashOf({ product, dir: resolve(productDir, part) });

  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));

  writeFileSync(mergedFileOf(productDir), `${JSON.stringify(sorted, null, 2)}\n`);
};

/** Drops the named parts from the product's `merged.json`. */
export const forgetMerged = (options: { productDir: string; parts: string[] }) => {
  const { productDir, parts } = options;
  const merged = readMerged(productDir);

  if (!parts.some((part) => part in merged)) return;

  for (const part of parts) delete merged[part];

  writeFileSync(mergedFileOf(productDir), `${JSON.stringify(merged, null, 2)}\n`);
};

/** The product folder that holds the part now: the product's own, else its base's. */
export const holderOf = (options: { product: HashedProduct; part: string }): HashedProduct => {
  const { product, part } = options;

  return !existsSync(resolve(product.dir, part)) && product.base && existsSync(resolve(product.base.dir, part))
    ? { dir: product.base.dir, config: product.base.config, base: null }
    : product;
};

/** The recorded parts of the product, outside `except`, whose files still match their recorded hash, with that hash. */
export const unchangedMergedOf = (options: { product: ResolvedProduct; except: string[] }) => {
  const { product, except } = options;
  const merged = readMerged(product.dir);

  return product.parts.flatMap((part) => {
    const key = partKeyOf(part);
    const hash = partHashOf({ product, dir: dirname(part.file) });

    return part.origin !== 'base' && !except.includes(key) && merged[key] === hash ? [{ key, hash }] : [];
  });
};

/** Records the parts of `before` whose hash differs now, and answers with their keys: an asset they use changed in a merge. */
export const rerecordChangedMerged = (options: {
  product: ResolvedProduct;
  before: { key: string; hash: string }[];
}) => {
  const { product, before } = options;
  const changed = before
    .filter(({ key, hash }) => partHashOf({ product, dir: resolve(product.dir, key) }) !== hash)
    .map(({ key }) => key);

  if (changed.length > 0) recordMerged({ product, parts: changed });

  return changed;
};

export const sketchedPartsOf = (product: ResolvedProduct) =>
  new Set(
    listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch === 'string'
        ? []
        : [
            sketch.target,
            ...sketch.variants.flatMap((variant) => partFilesOf(variantDirOf(sketch, variant)).parts.map(partKeyOf)),
          ],
    ),
  );

/**
 * The merged parts of a product whose files changed since their last sketch merge, while no open
 * sketch holds them. A merge of a sketch on the part records its new state and clears it.
 */
export const changedOutsideSketchOf = (product: ResolvedProduct): string[] => {
  const merged = readMerged(product.dir);
  const changed = product.parts.filter((part) => {
    const key = partKeyOf(part);

    return (
      part.origin !== 'base' &&
      merged[key] !== undefined &&
      partHashOf({ product, dir: dirname(part.file) }) !== merged[key]
    );
  });

  if (changed.length === 0) return [];

  const sketched = sketchedPartsOf(product);

  return changed.map(partKeyOf).filter((key) => !sketched.has(key));
};

export const ACCEPTED_FILE = 'accepted.json';

export type Acceptance = { part: string; by: string; note: string; hash: string; at: string; auto?: true };

export const readAccepted = (productDir: string): Acceptance[] => {
  const file = resolve(productDir, ACCEPTED_FILE);

  if (!existsSync(file)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return Array.isArray(parsed) ? (parsed as Acceptance[]) : [];
  } catch {
    return [];
  }
};

const logAcceptance = (productDir: string, entry: Acceptance) =>
  writeFileSync(
    resolve(productDir, ACCEPTED_FILE),
    `${JSON.stringify([...readAccepted(productDir), entry], null, 2)}\n`,
  );

/** Logs a sketch merged by itself because no state showed a visible change, as an `auto` entry in `accepted.json`. */
export const recordAutoMerge = (options: { product: HashedProduct; part: string; by: string }) => {
  const { part, by } = options;
  const product = holderOf(options);

  logAcceptance(product.dir, {
    part,
    by,
    note: 'merged automatically: no visible change in any state',
    hash: partHashOf({ product, dir: resolve(product.dir, part) }),
    at: new Date().toISOString(),
    auto: true,
  });
};

/** Logs a sketch merged without a pick in Studio because a plan entry allows it, in `accepted.json`. */
export const recordAllowedMerge = (options: { product: HashedProduct; part: string; by: string; planRef: string }) => {
  const { part, by, planRef } = options;
  const product = holderOf(options);

  logAcceptance(product.dir, {
    part,
    by,
    note: `merged without a pick: allowed by ${planRef}`,
    hash: partHashOf({ product, dir: resolve(product.dir, part) }),
    at: new Date().toISOString(),
  });
};

/**
 * Records a direct edit of a merged part the user approved: writes the part's current hash to `merged.json` and
 * logs who accepted it and why in `accepted.json`. Answers with why nothing was accepted, or `null`.
 */
export const acceptPart = (options: {
  product: ResolvedProduct;
  part: string;
  by: string;
  note: string;
}): string | null => {
  const { product, part, by, note } = options;

  if (!product.parts.some((candidate) => partKeyOf(candidate) === part)) return `NO PART "${part}" in ${product.name}`;

  if (sketchedPartsOf(product).has(part))
    return `${part} has an open sketch - merge or discard it; a merge records the part`;

  if (!changedOutsideSketchOf(product).includes(part))
    return `${part} has no change outside a sketch - nothing to accept`;

  recordMerged({ product, parts: [part] });

  const hash = readMerged(product.dir)[part] ?? '';
  const entry: Acceptance = { part, by, note, hash, at: new Date().toISOString() };

  logAcceptance(product.dir, entry);

  return null;
};
