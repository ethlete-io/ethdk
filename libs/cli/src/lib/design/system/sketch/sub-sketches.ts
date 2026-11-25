import { existsSync } from 'fs';
import { resolve } from 'path';
import { ResolvedProduct } from '../resolve-product';
import {
  createSketch,
  decideSketch,
  findSketch,
  parseTarget,
  rejectedProblemOf,
  Sketch,
  SketchApproval,
  SketchDecisionInput,
  sharedDirOf,
  SketchTarget,
  variantDirOf,
  writeSketchFile,
} from './sketch';
import { WriteOrigin } from '../write-origin';

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

/** Whether a pick of `variant` opens sub-sketches, or meets those another variant's pick opened, instead of merging. */
export const pickOpensSubSketches = (sketch: Sketch, variant: string) =>
  (sketch.subSketches?.length ?? 0) > 0
    ? !(sketch.decision?.kind === 'pick' && sketch.decision.variant === variant)
    : subPartsOfPick(sketch, variant).length > 0;

export type ApprovedSubSketch = { sketch: Sketch; approval: SketchApproval };

/** The sub-sketches of `sketch`: `approved` with each approval, `open` naming the rest; one no longer open counts as open. */
export const subSketchesOf = (options: { product: ResolvedProduct; sketch: Sketch }) => {
  const { product, sketch } = options;
  const approved: ApprovedSubSketch[] = [];
  const open: string[] = [];

  for (const key of sketch.subSketches ?? []) {
    const parsed = parseTarget(key);
    const found =
      typeof parsed === 'string'
        ? null
        : findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

    if (found !== null && typeof found !== 'string' && found.approved)
      approved.push({ sketch: found, approval: found.approved });
    else open.push(key);
  }

  return { approved, open };
};

/** Why `sketch` may not merge while a sub-sketch its pick opened is not approved, or `null`. */
export const unapprovedSubSketchesRefusalOf = (options: { product: ResolvedProduct; sketch: Sketch }) => {
  const { open } = subSketchesOf(options);
  const { sketch } = options;

  return open.length > 0
    ? `${sketch.target} waits on its sub-sketches ${open.join(', ')} - approve each (design sketch approve <sub-sketch> --variant <key>), then merge ${sketch.target}: it writes them together`
    : null;
};

/** Why `sketch` may not merge on its own because a pick of its parent opened it, or `null`. */
export const subSketchMergeRefusalOf = (sketch: Sketch) =>
  sketch.parent
    ? `${sketch.target} is a sub-sketch of ${sketch.parent} and never merges on its own - approve a variant (design sketch approve ${sketch.target} --variant <key>), and it merges together with ${sketch.parent}`
    : null;

/**
 * Records the designer's approval of `variant` on a sub-sketch in `approved`; the parent merges it later. Answers why
 * not: a sketch without `parent`, one not ready, or a variant it lacks or rejected. Writes sketch.json.
 */
export const approveSubSketch = (options: {
  sketch: Sketch;
  approval: { variant: string; comment?: string } & WriteOrigin;
}): Sketch | string => {
  const { sketch, approval } = options;
  const { variant } = approval;

  if (!sketch.parent)
    return `${sketch.target} is not a sub-sketch - only a sketch a parent's pick opened is approved; pick and merge it instead`;
  if (sketch.status !== 'ready') return `${sketch.target} is ${sketch.status} - a variant is approved once it is ready`;
  if (!sketch.variants.includes(variant))
    return `${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ')}`;

  const rejected = rejectedProblemOf(sketch, variant);

  if (rejected) return rejected;

  const approved: SketchApproval = { ...approval, decidedAt: new Date().toISOString() };
  const next: Sketch = { ...sketch, approved };

  writeSketchFile(next, { base: sketch, sets: ['approved'] });

  return next;
};
