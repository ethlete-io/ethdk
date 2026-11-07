import { dirname, isAbsolute, relative } from 'path';
import { reachableFilesOf } from '../reachable-files';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashHolds, staleBaselineOf } from './baseline';
import { overlaySketch } from './overlay';
import { Sketch } from './sketch';

const isInside = (dir: string, file: string) => {
  const path = relative(dir, file);

  return !path.startsWith('..') && !isAbsolute(path);
};

/** The product parts `variants` of the sketch draw without holding them: every part a held part reaches through its imports. */
export const embeddedByVariantsOf = (options: { product: ResolvedProduct; sketch: Sketch; variants: string[] }) => {
  const { product, sketch, variants } = options;
  const keys = new Set<string>();

  for (const variant of variants) {
    const overlaid = overlaySketch({ product, sketch, variant });
    const held = new Set(overlaid.sketched);
    const reached = [
      ...reachableFilesOf(
        overlaid,
        overlaid.parts.filter((part) => held.has(partKeyOf(part))),
      ).files.keys(),
    ];

    for (const part of product.parts)
      if (!held.has(partKeyOf(part)) && reached.some((file) => isInside(dirname(part.file), file)))
        keys.add(partKeyOf(part));
  }

  return [...keys].sort((a, b) => a.localeCompare(b));
};

/** The parts `variants` of the sketch embed that changed in the product since its baseline. */
export const staleEmbeddedOf = (options: { product: ResolvedProduct; sketch: Sketch; variants: string[] }) => {
  const { product, sketch } = options;
  const baseline = sketch.baseline ?? {};

  return embeddedByVariantsOf(options).filter((key) => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

    return part !== undefined && !partHashHolds({ product, dir: dirname(part.file), hash: baseline[key] });
  });
};

/**
 * `staleBaselineOf` together with the parts the variants embed: each part a variant holds or draws through an import
 * that changed in the product since the sketch's baseline, `[]` when it records none, `null` while the baseline is current.
 */
export const staleBaseOf = (options: { product: ResolvedProduct; sketch: Sketch }): string[] | null => {
  const { product, sketch } = options;

  if (!sketch.baseline) return [];

  const held = staleBaselineOf({ product, sketch }) ?? [];
  const embedded = staleEmbeddedOf({ product, sketch, variants: sketch.variants });
  const changed = [...new Set([...held, ...embedded])];

  return changed.length > 0 ? changed : null;
};
