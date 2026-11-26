import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { ASSETS_FOLDER } from '../assets';
import { Layer, LAYER_USES, LAYERS } from '../layers';
import { classifyImport, partDependenciesOf } from '../imports';
import { fixturesOf, partFilesOf } from '../product';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { importsOf } from '../ts-source';
import { editOldBaseOf } from './edit-old-base';
import { changesOnlyImports, importsAnyOf } from './host-edit';
import { listSketches, Sketch, sharedDirOf, variantDirOf, variantSharedDirOf } from './sketch';

/** A part the product does not hold of its own yet, drawn from the variant `variant` of the open sketch on `sketch`. */
export type BorrowedPart = { part: string; sketch: string; variant: string };

export type SketchedProduct = ResolvedProduct & {
  sketched: string[];
  sharedDir: string;
  variantSharedDir: string;
  assetsDir: string;
  borrowed: BorrowedPart[];
  /** The `shared/` folders of the sketches it borrows from, where a borrowed part finds its own `@shared/...`. */
  lentSharedDirs: string[];
  /** Whether the user picked this variant; before that its part may still hold fewer states than a merged one. */
  picked: boolean;
};

/** The variant an open sketch lends its new parts in: the user's pick, else the one its agent recommends. */
export const lentVariantOf = (sketch: Sketch) => {
  const variant = sketch.decision?.kind === 'pick' ? sketch.decision.variant : sketch.recommended;

  return variant && sketch.variants.includes(variant) ? variant : null;
};

/** Each part `keys` names that another open sketch of the product draws as a new target, and the sketch it comes from. */
export const openSketchesDrawingOf = (sketch: Sketch, keys: Set<string>) =>
  keys.size === 0
    ? []
    : listSketches({ productDir: dirname(dirname(sketch.dir)), product: sketch.product }).flatMap((other) =>
        typeof other === 'string' || other.dir === sketch.dir || other.decision?.kind === 'discard'
          ? []
          : other.targets.filter((key) => keys.has(key)).map((part) => ({ part, sketch: other })),
      );

/** The parts the `.ts` files below the sketch's `shared/` folders import; each variant typechecks them all. */
export const sharedPartKeysOf = (sketch: Sketch, variant: string) =>
  [sharedDirOf(sketch), variantSharedDirOf(sketch, variant)]
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.ts'))
        .map((name) => resolve(dir, name)),
    )
    .flatMap((file) => importsOf(readFileSync(file, 'utf8')).map(classifyImport))
    .flatMap((imported) => (imported.kind === 'part' ? [partKeyOf(imported)] : []));

type LendOptions = { sketch: Sketch; held: ResolvedPart[]; needs: string[]; has: Set<string>; baseKeys: Set<string> };

const lentPartsOf = (options: LendOptions) => {
  const missing = new Set(
    [...options.held.flatMap((part) => partDependenciesOf(part)).map(partKeyOf), ...options.needs].filter(
      (key) => !options.has.has(key),
    ),
  );

  return openSketchesDrawingOf(options.sketch, missing).flatMap(({ part, sketch }) => {
    const variant = lentVariantOf(sketch);
    const file = variant
      ? partFilesOf(variantDirOf(sketch, variant)).parts.find((entry) => partKeyOf(entry) === part)
      : null;

    if (!variant || !file) return [];

    const resolved: ResolvedPart = {
      ...file,
      origin: options.baseKeys.has(part) ? 'overridden' : 'product',
      source: readFileSync(file.file, 'utf8'),
      cssSource: file.css && existsSync(file.css) ? readFileSync(file.css, 'utf8') : null,
    };

    return [
      {
        resolved,
        borrowed: { part, sketch: sketch.target, variant },
        sharedDirs: [variantSharedDirOf(sketch, variant), sharedDirOf(sketch)],
      },
    ];
  });
};

const borrowedPartsOf = (options: LendOptions) => {
  const has = new Set(options.has);
  const borrowed: ReturnType<typeof lentPartsOf> = [];
  let held = options.held;
  let needs = options.needs;

  while (held.length > 0 || needs.length > 0) {
    const lent = lentPartsOf({ ...options, held, needs, has });

    for (const entry of lent) has.add(entry.borrowed.part);
    borrowed.push(...lent);
    held = lent.map(({ resolved }) => resolved);
    needs = [];
  }

  return borrowed;
};

const mayChange = (sketch: Sketch, part: { layer: (typeof LAYERS)[number]; name: string }) =>
  sketch.targets.some((key) => {
    const layer = key.split('/')[0] as Layer;

    return key === partKeyOf(part) || part.layer === layer || LAYER_USES[layer].includes(part.layer);
  });

/**
 * The product as one variant of a sketch draws it: each part the variant holds replaces the part the
 * product resolves under the same name, or joins it when the product has none. `sketched` names the
 * parts the variant holds, `sharedDir` the sketch's `shared/` folder its parts import as `@shared/...` (the
 * variant's own `variantSharedDir` first), and
 * `assetsDir` the variant's own `assets/` folder, which `@assets/...` looks in first.
 */
export const overlaySketch = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): SketchedProduct => {
  const { sketch, variant } = options;
  const product = editOldBaseOf(options);
  const dir = variantDirOf(sketch, variant);
  const own = partFilesOf(dir);
  const baseKeys = new Set(product.parts.filter((part) => part.origin !== 'product').map(partKeyOf));
  const sketched = own.parts.map((file): ResolvedPart => ({
    ...file,
    origin: baseKeys.has(partKeyOf(file)) ? 'overridden' : 'product',
    source: readFileSync(file.file, 'utf8'),
    cssSource: file.css && existsSync(file.css) ? readFileSync(file.css, 'utf8') : null,
  }));
  const keys = new Set(sketched.map(partKeyOf));
  const borrowed = borrowedPartsOf({
    sketch,
    held: sketched,
    needs: sharedPartKeysOf(sketch, variant),
    has: new Set([...keys, ...product.parts.filter((part) => part.origin !== 'base').map(partKeyOf)]),
    baseKeys,
  });
  const replaced = new Set([...keys, ...borrowed.map((entry) => entry.borrowed.part)]);
  const parts = [
    ...product.parts.filter((part) => !replaced.has(partKeyOf(part))),
    ...sketched,
    ...borrowed.map(({ resolved }) => resolved),
  ].sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || a.name.localeCompare(b.name));
  const isImportOnlyHostEdit = (part: ResolvedPart) => {
    const before = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));

    return (
      before !== undefined &&
      before.cssSource === part.cssSource &&
      importsAnyOf(before.source, sketch.targets) &&
      changesOnlyImports(before.source, part.source)
    );
  };
  const outside: Problem[] = sketched
    .filter((part) => !mayChange(sketch, part) && !isImportOnlyHostEdit(part))
    .map((part) => ({
      rule: 'SKETCH',
      file: part.file,
      message: `${
        sketch.targets.length > 1
          ? `a sketch on ${sketch.targets.join(', ')} may change their layers and the layers below them, not ${partKeyOf(part)}`
          : `a sketch on ${sketch.target} may change ${sketch.layer} and the layers below it, not ${partKeyOf(part)}`
      }${importsAnyOf(part.source, sketch.targets) ? ' - a host of it may change only its imports' : ''}`,
    }));

  return {
    ...product,
    parts,
    fixtures: fixturesOf(dir) ?? product.fixtures,
    problems: [...product.problems, ...own.problems, ...outside],
    sketched: [...keys],
    sharedDir: sharedDirOf(sketch),
    variantSharedDir: variantSharedDirOf(sketch, variant),
    assetsDir: resolve(dir, ASSETS_FOLDER),
    borrowed: borrowed.map((entry) => entry.borrowed),
    lentSharedDirs: [...new Set(borrowed.flatMap((entry) => entry.sharedDirs))],
    picked: sketch.decision?.kind === 'pick' && sketch.decision.variant === variant,
  };
};
