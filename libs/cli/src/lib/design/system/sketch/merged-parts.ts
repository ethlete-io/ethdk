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

const sketchedPartsOf = (product: ResolvedProduct) =>
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
