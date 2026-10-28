import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { SHARED_PREFIX } from '../imports';
import { partKeyOf } from '../resolve-product';
import { importsOf } from '../ts-source';
import { SHARED_FOLDER, sharedDirOf, Sketch } from './sketch';

type PartFile = { layer: string; name: string; file: string };

const SOURCE = /\.(?:ts|js|mjs)$/u;

const sourceFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => SOURCE.test(path))
        .map((path) => resolve(dir, path))
    : [];

const importsShared = (file: string) =>
  importsOf(readFileSync(file, 'utf8')).some((specifier) => specifier.startsWith(SHARED_PREFIX));

const sharedImportersOf = (parts: PartFile[]) =>
  parts.filter((part) => sourceFilesIn(dirname(part.file)).some(importsShared));

/**
 * What a merge does with the sketch's `shared/` folder: `carry` when the target imports it, `drop` when no part
 * does, or why the merge must stop - a part other than the target imports it, or the target holds a `shared/`
 * folder of its own.
 */
export const sharedPlanOf = (options: { sketch: Sketch; parts: PartFile[] }): 'carry' | 'drop' | string => {
  const { sketch, parts } = options;
  const importers = sharedImportersOf(parts);
  const others = importers.filter((part) => partKeyOf(part) !== sketch.target);
  const target = importers.find((part) => partKeyOf(part) === sketch.target);

  if (others.length > 0)
    return `${others.map(partKeyOf).join(', ')} import ${SHARED_PREFIX} - only ${sketch.target} takes the sketch's ${SHARED_FOLDER}/ into the product; move that code into the part`;
  if (!target) return 'drop';
  if (existsSync(resolve(dirname(target.file), SHARED_FOLDER)))
    return `${sketch.target} holds a ${SHARED_FOLDER}/ folder of its own and imports ${SHARED_PREFIX} - rename the folder`;

  return 'carry';
};

const relativeSpecifierOf = (options: { from: string; to: string }) => {
  const path = relative(dirname(options.from), options.to).split(sep).join('/');

  return path.startsWith('.') ? path : `./${path}`;
};

/** Copies the sketch's `shared/` folder into the merged target's folder and turns each `@shared/` import there into a relative one. */
export const carryShared = (options: { sketch: Sketch; targetDir: string }) => {
  const { sketch, targetDir } = options;
  const shared = resolve(targetDir, SHARED_FOLDER);

  if (existsSync(sharedDirOf(sketch))) cpSync(sharedDirOf(sketch), shared, { recursive: true });

  for (const file of sourceFilesIn(targetDir)) {
    const source = readFileSync(file, 'utf8');
    const rewritten = source.replace(
      new RegExp(`(['"])${SHARED_PREFIX}([^'"]+)\\1`, 'gu'),
      (...[, quote, path]: string[]) =>
        `${quote}${relativeSpecifierOf({ from: file, to: resolve(shared, path ?? '') })}${quote}`,
    );

    if (rewritten !== source) writeFileSync(file, rewritten);
  }
};
