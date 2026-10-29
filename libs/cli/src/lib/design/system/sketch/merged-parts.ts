import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { folderHashOf } from './baseline';
import { listSketches, variantDirOf } from './sketch';

export const MERGED_FILE = 'merged.json';

const mergedFileOf = (productDir: string) => resolve(productDir, MERGED_FILE);

/** The content hash of each part folder as its last sketch merge left it, under the part key. */
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

/** Records the current content hash of each named part folder of the product as merged. */
export const recordMerged = (options: { productDir: string; parts: string[] }) => {
  const { productDir, parts } = options;
  const merged = readMerged(productDir);

  for (const part of parts) merged[part] = folderHashOf(resolve(productDir, part));

  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));

  writeFileSync(mergedFileOf(productDir), `${JSON.stringify(sorted, null, 2)}\n`);
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

    return part.origin !== 'base' && merged[key] !== undefined && folderHashOf(dirname(part.file)) !== merged[key];
  });

  if (changed.length === 0) return [];

  const sketched = sketchedPartsOf(product);

  return changed.map(partKeyOf).filter((key) => !sketched.has(key));
};

export const ACCEPTED_FILE = 'accepted.json';

export type Acceptance = { part: string; by: string; note: string; hash: string; at: string };

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

  recordMerged({ productDir: product.dir, parts: [part] });

  const hash = readMerged(product.dir)[part] ?? '';
  const entry: Acceptance = { part, by, note, hash, at: new Date().toISOString() };

  writeFileSync(
    resolve(product.dir, ACCEPTED_FILE),
    `${JSON.stringify([...readAccepted(product.dir), entry], null, 2)}\n`,
  );

  return null;
};
