import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
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

/** The files of the sketch's and the variant's `shared/` under their path there, the variant's file winning. */
const sketchSharedFilesOf = (sketch: Sketch, variant: string) => {
  const files = new Map<string, string>();

  for (const dir of [sharedDirOf(sketch), variantSharedDirOf(sketch, variant)])
    for (const file of filesBelow(dir)) files.set(relative(dir, file), file);

  return files;
};

/**
 * What a merge does with the sketch's `shared/` folder: `carry` when the target imports a file of it the product's
 * `shared/` does not hold, `drop` when no part does, or why the merge must stop - a part other than the target
 * imports one, or the target holds a `shared/` folder of its own.
 */
export const sharedPlanOf = (options: {
  sketch: Sketch;
  parts: PartFile[];
  product: SharedProduct;
}): 'carry' | 'drop' | string => {
  const { sketch, parts, product } = options;
  const importers = sharedImportersOf(product, parts);
  const others = importers.filter((part) => partKeyOf(part) !== sketch.target);
  const target = importers.find((part) => partKeyOf(part) === sketch.target);

  if (others.length > 0)
    return `${others.map(partKeyOf).join(', ')} import ${SHARED_PREFIX} - only ${sketch.target} takes the sketch's ${SHARED_FOLDER}/ into the product; move that code into the part`;
  if (!target) return 'drop';
  if (existsSync(resolve(dirname(target.file), SHARED_FOLDER)))
    return `${sketch.target} holds a ${SHARED_FOLDER}/ folder of its own and imports ${SHARED_PREFIX} - rename the folder`;

  return 'carry';
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

const relativeSpecifierOf = (options: { from: string; to: string }) => {
  const path = relative(dirname(options.from), options.to).split(sep).join('/');

  return path.startsWith('.') ? path : `./${path}`;
};

/**
 * Copies the files of the sketch's `shared/` folder, the picked variant's own `shared/` winning, that the product's
 * `shared/` does not hold into the merged target's folder, and turns each `@shared/` import of them there into a
 * relative one.
 */
export const carryShared = (options: {
  sketch: Sketch;
  variant: string;
  targetDir: string;
  product: SharedProduct;
}) => {
  const { sketch, variant, targetDir, product } = options;
  const shared = resolve(targetDir, SHARED_FOLDER);

  for (const [path, file] of sketchSharedFilesOf(sketch, variant)) {
    if (inProductShared(product, path)) continue;

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
