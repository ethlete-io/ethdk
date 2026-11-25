import { existsSync, readFileSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { ASSETS_FOLDER, filesBelow } from '../assets';
import { addressSketchComments, resolveSketchEndComments } from '../comments/comment';
import { productSharedDirsOf, SHARED_FOLDER, sharedFileOf } from '../imports';
import { ResolvedProduct } from '../resolve-product';
import { sketchSharedFilesOf } from './merge-shared';
import {
  clearSketchReport,
  createSketch,
  decideSketch,
  findSketch,
  parseTarget,
  rejectedProblemOf,
  removeSketchDir,
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
 * What a pick of `variant` does to the sub-sketches an earlier pick of another variant opened: `discards` those the
 * variant does not mark, approved ones too, `keeps` those it marks again, and `opens` its marks without one.
 */
export const subSketchChangeOf = (sketch: Sketch, variant: string) => {
  const open = sketch.subSketches ?? [];
  const marks = subPartsOfPick(sketch, variant);

  return {
    discards: open.filter((key) => !marks.includes(key)),
    keeps: open.filter((key) => marks.includes(key)),
    opens: marks.filter((key) => !open.includes(key)),
  };
};

/** Why a pick of `variant` may not discard sub-sketches without the designer's confirmation, or `null`. */
export const subSketchDiscardRefusalOf = (sketch: Sketch, variant: string) => {
  const { discards, keeps } = subSketchChangeOf(sketch, variant);

  return discards.length > 0
    ? `a pick of ${sketch.target} variant ${variant} discards the sub-sketches ${discards.join(', ')}${keeps.length > 0 ? ` and keeps ${keeps.join(', ')}` : ''} - pick again with --discard-sub-sketches to confirm`
    : null;
};

const closeSubSketch = (options: { checkout: string; product: ResolvedProduct; key: string; parent: string }) => {
  const parsed = parseTarget(options.key);
  const sub =
    typeof parsed === 'string'
      ? null
      : findSketch({ productDir: options.product.dir, product: options.product.name, sketch: parsed });

  if (sub === null || typeof sub === 'string') return;

  resolveSketchEndComments({ sketch: sub, note: `resolved by the new pick of ${options.parent}` });
  addressSketchComments({ sketch: sub, reason: 'discard' });
  removeSketchDir(sub.dir);
  clearSketchReport({ checkout: options.checkout, sketch: sub });
};

/**
 * Records the pick of a variant that marks sub-parts and opens one sketch per sub-part, with one variant seeded from
 * the picked variant's part folder and `parent` naming `sketch`; `sketch` records them in `subSketches` and stays
 * unmerged. A pick of another variant than the picked one closes the sub-sketches it does not mark (only with
 * `discardSubSketches`), keeps those it marks again and opens the rest. Answers why not before any write. Run it inside
 * a journal: a throw after the first write undoes them all.
 */
export const openSubSketches = (options: {
  checkout: string;
  product: ResolvedProduct;
  sketch: Sketch;
  pick: Extract<SketchDecisionInput, { kind: 'pick' }>;
  discardSubSketches?: boolean;
}): { variant: string; subSketches: string[]; discarded: string[]; kept: string[]; sketch: Sketch } | string => {
  const { product, sketch, pick } = options;
  const { variant } = pick;
  const picked = sketch.decision?.kind === 'pick' ? sketch.decision.variant : null;
  const open = sketch.subSketches ?? [];

  if (open.length > 0 && picked === variant) return { variant, subSketches: open, discarded: [], kept: open, sketch };

  const { discards, keeps, opens } = subSketchChangeOf(sketch, variant);
  const unconfirmed = options.discardSubSketches ? null : subSketchDiscardRefusalOf(sketch, variant);

  if (unconfirmed) return unconfirmed;

  const parts = opens.map((key) => ({ key, parsed: parseTarget(key) }));
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

  for (const key of discards) closeSubSketch({ checkout: options.checkout, product, key, parent: sketch.target });

  const shared = existsSync(sharedDirOf(sketch)) ? sharedDirOf(sketch) : null;
  const author = sketch.variantInfo[variant]?.authors?.[0];
  const opened = (sources as { target: SketchTarget; folder: string }[]).map(({ target, folder }) => {
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
  const subSketches = [...keeps, ...opened];
  const next: Sketch = { ...decided, subSketches };

  writeSketchFile(next, { base: decided, sets: ['subSketches'] });

  return { variant, subSketches, discarded: discards, kept: keeps, sketch: next };
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

type ChangedFile = { path: string; file: string };

const assetFilesOf = (variantDir: string) => {
  const root = resolve(variantDir, ASSETS_FOLDER);

  return new Map(filesBelow(root).map((file) => [relative(root, file), file]));
};

const sameFile = (a: string | null | undefined, b: string) =>
  !!a && existsSync(a) && readFileSync(a).equals(readFileSync(b));

const changedOf = (files: Map<string, string>, bases: ((path: string) => string | null | undefined)[]) =>
  [...files]
    .filter(([path, file]) => !bases.some((base) => sameFile(base(path), file)))
    .map(([path, file]) => ({ path, file }));

/**
 * The `shared/` and `assets/` files each approved sub-sketch of `sketch` changes - those that differ from the
 * product's and from the parent's - or which file two sketches of the merge change to different contents.
 */
export const subSketchFilesOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): { sub: ApprovedSubSketch; shared: ChangedFile[]; assets: ChangedFile[] }[] | string => {
  const { product, sketch, variant } = options;
  const approved = subSketchesOf({ product, sketch }).approved;

  if (approved.length === 0) return [];

  const productShared = (path: string) => sharedFileOf({ dirs: productSharedDirsOf(product), path });
  const productAsset = (path: string) =>
    [product.dir, ...(product.base ? [product.base.dir] : [])]
      .map((dir) => resolve(dir, ASSETS_FOLDER, path))
      .find((file) => existsSync(file));
  const parentShared = sketchSharedFilesOf(sketch, variant);
  const parentAssets = assetFilesOf(variantDirOf(sketch, variant));
  const subs = approved.map((sub) => ({
    sub,
    shared: changedOf(sketchSharedFilesOf(sub.sketch, sub.approval.variant), [
      productShared,
      (path) => parentShared.get(path),
    ]),
    assets: changedOf(assetFilesOf(variantDirOf(sub.sketch, sub.approval.variant)), [
      productAsset,
      (path) => parentAssets.get(path),
    ]),
  }));
  const writers = [
    {
      target: sketch.target,
      shared: changedOf(parentShared, [productShared]),
      assets: changedOf(parentAssets, [productAsset]),
    },
    ...subs.map(({ sub, shared, assets }) => ({ target: sub.sketch.target, shared, assets })),
  ];

  for (const folder of [SHARED_FOLDER, ASSETS_FOLDER] as const) {
    const byPath = new Map<string, { target: string; file: string }[]>();

    for (const writer of writers)
      for (const { path, file } of folder === SHARED_FOLDER ? writer.shared : writer.assets)
        byPath.set(path, [...(byPath.get(path) ?? []), { target: writer.target, file }]);

    for (const [path, changes] of byPath) {
      const [first] = changes;

      if (first && changes.some(({ file }) => !sameFile(first.file, file)))
        return `${folder}/${path.split(sep).join('/')} is changed by ${changes.map(({ target }) => target).join(' and ')} - keep the change in one of them, then merge ${sketch.target}`;
    }
  }

  return subs;
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
  if (sketch.status !== 'ready')
    return `${sketch.target} is ${sketch.status} - mark it ready first (design sketch ready ${sketch.target}), then approve a variant`;
  if (!sketch.variants.includes(variant))
    return `${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ')}`;

  const rejected = rejectedProblemOf(sketch, variant);

  if (rejected) return rejected;

  const approved: SketchApproval = { ...approval, decidedAt: new Date().toISOString() };
  const next: Sketch = { ...sketch, approved };

  writeSketchFile(next, { base: sketch, sets: ['approved'] });

  return next;
};
