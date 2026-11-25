import { existsSync } from 'fs';
import { resolve } from 'path';
import { ResolvedProduct } from '../resolve-product';
import {
  createSketch,
  decideSketch,
  findSketch,
  parseTarget,
  Sketch,
  SketchDecisionInput,
  sharedDirOf,
  SketchTarget,
  variantDirOf,
  writeSketchFile,
} from './sketch';

/** The sub-parts the variant marks; a pick of a variant with any opens sub-sketches instead of merging. */
export const subPartsOfPick = (sketch: Sketch, variant: string) => sketch.variantInfo[variant]?.subParts ?? [];

const SUB_SKETCH_VARIANT = 'a';

/**
 * Records the pick of a variant that marks sub-parts and opens one sketch per sub-part, with one variant seeded from
 * the picked variant's part folder and `parent` naming `sketch`; `sketch` records them in `subSketches` and stays
 * unmerged. Answers why not before any write. Run it inside a journal: a throw after the first write undoes them all.
 */
export const openSubSketches = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  pick: Extract<SketchDecisionInput, { kind: 'pick' }>;
}): { variant: string; subSketches: string[] } | string => {
  const { product, sketch, pick } = options;
  const { variant } = pick;
  const open = sketch.subSketches ?? [];

  if (open.length > 0) {
    const picked = sketch.decision?.kind === 'pick' ? sketch.decision.variant : null;

    return picked === variant
      ? { variant, subSketches: open }
      : `${sketch.target} was picked as variant ${picked} and has the sub-sketches ${open.join(', ')} - a new pick would discard them, which is not possible yet`;
  }

  const parts = subPartsOfPick(sketch, variant).map((key) => ({ key, parsed: parseTarget(key) }));
  const sources = parts.map(({ key, parsed }) => {
    if (typeof parsed === 'string') return `${sketch.target} variant ${variant} marks ${key}: ${parsed}`;

    const folder = resolve(variantDirOf(sketch, variant), parsed.layer, parsed.name);

    if (!existsSync(folder)) return `${sketch.target} variant ${variant} marks ${key} but holds no ${key}`;
    if (findSketch({ productDir: product.dir, product: product.name, sketch: parsed }) !== null)
      return `${key} already has an open sketch - merge or discard it before the pick of ${sketch.target} variant ${variant} opens one`;

    return { target: parsed, folder };
  });
  const refused = sources.find((source): source is string => typeof source === 'string');

  if (refused !== undefined) return refused;

  const decided = decideSketch({ sketch, decision: pick });

  if (typeof decided === 'string') return decided;

  const shared = existsSync(sharedDirOf(sketch)) ? sharedDirOf(sketch) : null;
  const author = sketch.variantInfo[variant]?.authors?.[0];
  const subSketches = (sources as { target: SketchTarget; folder: string }[]).map(({ target, folder }) => {
    const created = createSketch({
      product,
      sketch: target,
      variants: [SUB_SKETCH_VARIANT],
      like: { folder, name: target.name, shared },
      ...(author ? { author } : {}),
    });

    if (typeof created === 'string') throw new Error(created);

    writeSketchFile({ ...created, parent: sketch.target }, { base: created, sets: ['parent'] });

    return created.target;
  });

  writeSketchFile({ ...decided, subSketches }, { base: decided, sets: ['subSketches'] });

  return { variant, subSketches };
};

/** Why `sketch` may not merge while sub-sketches its pick opened are open, or `null`. */
export const openSubSketchesRefusalOf = (sketch: Sketch) =>
  sketch.subSketches && sketch.subSketches.length > 0
    ? `${sketch.target} waits on its sub-sketches ${sketch.subSketches.join(', ')} - it merges together with them once they are approved`
    : null;
