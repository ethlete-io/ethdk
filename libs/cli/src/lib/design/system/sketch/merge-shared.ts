import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { filesBelow } from '../assets';
import { ProductSource } from '../base';
import { productSharedDirsOf, SHARED_FOLDER, SHARED_PREFIX, sharedFileOf } from '../imports';
import { partKeyOf } from '../resolve-product';
import { importsOf } from '../ts-source';
import { sharedDirOf, Sketch, sourceFilesIn, variantSharedDirOf } from './sketch';

type PartFile = { layer: string; name: string; file: string };
type SharedProduct = Pick<ProductSource, 'dir'> & { base: Pick<ProductSource, 'dir'> | null };

const inProductShared = (product: SharedProduct, path: string) =>
  sharedFileOf({ dirs: productSharedDirsOf(product), path }) !== null;

const importsSketchShared = (product: SharedProduct, file: string) =>
  importsOf(readFileSync(file, 'utf8')).some(
    (specifier) =>
      specifier.startsWith(SHARED_PREFIX) && !inProductShared(product, specifier.slice(SHARED_PREFIX.length)),
  );

const sharedImportersOf = (product: SharedProduct, parts: PartFile[]) =>
  parts.filter((part) => sourceFilesIn(dirname(part.file)).some((file) => importsSketchShared(product, file)));

const sketchSharedDirsOf = (sketch: Sketch, variant: string) => [
  variantSharedDirOf(sketch, variant),
  sharedDirOf(sketch),
];

/** The files of the sketch's and the variant's `shared/` under their path there, the variant's file winning. */
const sketchSharedFilesOf = (sketch: Sketch, variant: string) => {
  const files = new Map<string, string>();

  for (const dir of sketchSharedDirsOf(sketch, variant).reverse())
    for (const file of filesBelow(dir)) files.set(relative(dir, file), file);

  return files;
};

const SOURCE = /\.(?:ts|js|mjs)$/u;

const reachedSharedOf = (options: { dirs: string[]; partDir: string; product: SharedProduct }) => {
  const { dirs, partDir, product } = options;
  const reached = new Set<string>();
  const queue = sourceFilesIn(partDir).map((file) => ({ file, at: null as string | null }));

  for (let next = queue.shift(); next; next = queue.shift()) {
    for (const specifier of importsOf(readFileSync(next.file, 'utf8'))) {
      const path = specifier.startsWith(SHARED_PREFIX)
        ? specifier.slice(SHARED_PREFIX.length)
        : next.at !== null && specifier.startsWith('.')
          ? join(dirname(next.at), specifier)
          : null;

      if (path === null || path.startsWith('..')) continue;
      if (specifier.startsWith(SHARED_PREFIX) && inProductShared(product, path)) continue;

      const file = sharedFileOf({ dirs, path });
      const dir = file && dirs.find((candidate) => !relative(candidate, file).startsWith('..'));

      if (!file || !dir) continue;

      const at = relative(dir, file);

      if (reached.has(at)) continue;

      reached.add(at);

      if (SOURCE.test(at)) queue.push({ file, at });
    }
  }

  return reached;
};

/**
 * What a merge does with the sketch's `shared/` folder: `carry` names the folder of each target with the paths of the
 * files the product's `shared/` does not hold that it takes - each file it imports, directly or through another such
 * file, and each file nobody imports that its `shared/` held in the product; a file nobody imports and no target held
 * goes to the one target importing `@shared/`. Or why the merge must stop - a part other than a target imports one, a
 * target taking files holds a `shared/` folder of its own, or a file nobody imports has no target to go to.
 */
export const sharedPlanOf = (options: {
  sketch: Sketch;
  variant: string;
  parts: PartFile[];
  product: SharedProduct & { parts: PartFile[] };
}): { carry: { targetDir: string; paths: string[] }[] } | string => {
  const { sketch, variant, parts, product } = options;
  const importers = sharedImportersOf(product, parts);
  const others = importers.filter((part) => !sketch.targets.includes(partKeyOf(part)));
  const takers = sketch.targets.join(', ');

  if (others.length > 0)
    return `${others.map(partKeyOf).join(', ')} import ${SHARED_PREFIX} - only ${takers} take${sketch.targets.length > 1 ? '' : 's'} the sketch's ${SHARED_FOLDER}/ into the product; move that code into the part`;

  const dirs = sketchSharedDirsOf(sketch, variant);
  const targets = parts.filter((part) => sketch.targets.includes(partKeyOf(part)));
  const reached = targets.map((part) => reachedSharedOf({ dirs, partDir: dirname(part.file), product }));
  const unreached = [...sketchSharedFilesOf(sketch, variant).keys()].filter(
    (path) => !inProductShared(product, path) && !reached.some((paths) => paths.has(path)),
  );
  const heldBy = (part: PartFile, path: string) =>
    product.parts.some(
      (held) => partKeyOf(held) === partKeyOf(part) && existsSync(resolve(dirname(held.file), SHARED_FOLDER, path)),
    );
  const ownersOf = (path: string) => targets.filter((part) => heldBy(part, path));
  const solo = importers.length === 1 ? importers[0] : undefined;
  const orphan = importers.length > 1 ? unreached.find((path) => ownersOf(path).length === 0) : undefined;

  if (orphan !== undefined)
    return `${SHARED_FOLDER}/${orphan.split(sep).join('/')} is imported by no target and was held by none in the product - import it or delete it`;

  const carry = targets
    .map((part, index) => ({
      part,
      paths: [
        ...(reached[index] ?? []),
        ...unreached.filter((path) => (ownersOf(path).length > 0 ? heldBy(part, path) : part === solo)),
      ].sort(),
    }))
    .filter(({ paths }) => paths.length > 0);
  const owning = carry.find(({ part }) => existsSync(resolve(dirname(part.file), SHARED_FOLDER)));

  if (owning)
    return `${partKeyOf(owning.part)} holds a ${SHARED_FOLDER}/ folder of its own and imports ${SHARED_PREFIX} - rename the folder`;

  return { carry: carry.map(({ part, paths }) => ({ targetDir: resolve(product.dir, part.layer, part.name), paths })) };
};

/**
 * The files of the sketch's and the variant's `shared/` whose path the product's or its base's `shared/` holds, each
 * with the file it replaces in the product's own `shared/`.
 */
export const productSharedChangesOf = (options: { sketch: Sketch; variant: string; product: SharedProduct }) => {
  const { sketch, variant, product } = options;

  return [...sketchSharedFilesOf(sketch, variant)]
    .filter(([path]) => inProductShared(product, path))
    .map(([path, file]) => ({ from: file, to: resolve(product.dir, SHARED_FOLDER, path) }));
};

/** The paths of the product's or its base's `shared/` files that the sketch's or the variant's `shared/` changes. */
export const editedSharedPathsOf = (options: { sketch: Sketch; variant: string; product: SharedProduct }) => {
  const { sketch, variant, product } = options;

  return [...sketchSharedFilesOf(sketch, variant)].flatMap(([path, file]) => {
    const own = sharedFileOf({ dirs: productSharedDirsOf(product), path });

    return own && readFileSync(own, 'utf8') !== readFileSync(file, 'utf8') ? [path.split(sep).join('/')] : [];
  });
};

const relativeSpecifierOf = (options: { from: string; to: string }) => {
  const path = relative(dirname(options.from), options.to).split(sep).join('/');

  return path.startsWith('.') ? path : `./${path}`;
};

/**
 * Copies the files at `paths` of the sketch's `shared/` folder, the picked variant's own `shared/` winning, into the
 * merged target's folder, and turns each `@shared/` import there of a file the product's `shared/` does not hold into a
 * relative one.
 */
export const carryShared = (options: {
  sketch: Sketch;
  variant: string;
  targetDir: string;
  paths: string[];
  product: SharedProduct;
}) => {
  const { sketch, variant, targetDir, paths, product } = options;
  const shared = resolve(targetDir, SHARED_FOLDER);
  const files = sketchSharedFilesOf(sketch, variant);

  for (const path of paths) {
    const file = files.get(path);

    if (!file) continue;

    mkdirSync(dirname(resolve(shared, path)), { recursive: true });
    cpSync(file, resolve(shared, path));
  }

  for (const file of sourceFilesIn(targetDir)) {
    const source = readFileSync(file, 'utf8');
    const rewritten = source.replace(new RegExp(`(['"])${SHARED_PREFIX}([^'"]+)\\1`, 'gu'), (...args: string[]) => {
      const [match = '', quote = '', path = ''] = args;

      return inProductShared(product, path)
        ? match
        : `${quote}${relativeSpecifierOf({ from: file, to: resolve(shared, path) })}${quote}`;
    });

    if (rewritten !== source) writeFileSync(file, rewritten);
  }
};
