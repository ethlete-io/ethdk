import { dirname, isAbsolute, relative } from 'path';
import { reachableFilesOf } from '../reachable-files';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashHolds, staleBaselineOf } from './baseline';
import { overlaySketch } from './overlay';
import { Problem } from '../problem';
import { listSketches, Sketch } from './sketch';

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

/**
 * One SKETCH-BASE-STALE problem, with its printed line, per undiscarded sketch (open or picked) whose base changed since it was drawn or
 * rebased; with `parts`, only the sketches where one of those parts changed; with `targets`, only the sketches on those targets.
 */
export const staleSketchBasesOf = (options: {
  product: ResolvedProduct;
  invocation: string;
  parts?: Set<string>;
  targets?: Set<string>;
}): (Problem & { line: string })[] => {
  const { product, invocation, parts, targets } = options;

  return listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) => {
    if (typeof sketch === 'string' || sketch.decision?.kind === 'discard') return [];
    if (targets && !targets.has(sketch.target)) return [];

    const changed = staleBaseOf({ product, sketch });

    if (!changed?.length || (parts && !changed.some((part) => parts.has(part)))) return [];

    const message = `${changed.join(', ')} changed since the sketch was drawn - bring each variant up to date, then run ${invocation} sketch rebase ${sketch.target} --product ${product.name} --by <model id>`;

    return [
      {
        rule: 'SKETCH-BASE-STALE',
        file: sketch.dir,
        message,
        line: `SKETCH-BASE-STALE ${product.name} ${sketch.target}: ${message}`,
      },
    ];
  });
};
