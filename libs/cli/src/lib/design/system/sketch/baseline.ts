import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fixturesOf, PartFile, partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';

export const FIXTURES_KEY = 'fixtures.ts';

const filesBelow = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = resolve(dir, name);

      return statSync(path).isDirectory() ? filesBelow(path) : [path];
    });

const hashOf = (paths: { root: string; files: string[] }) => {
  const hash = createHash('sha256');

  for (const file of paths.files) hash.update(`${relative(paths.root, file)}\0`).update(readFileSync(file));

  return hash.digest('hex').slice(0, 16);
};

export const folderHashOf = (dir: string) => hashOf({ root: dir, files: filesBelow(dir) });

/**
 * The content hash of each part folder the product resolves, and of its fixture set, under the part
 * key and `fixtures.ts`. A sketch keeps it to tell when a part it replaces changed in the product.
 */
export const baselineOf = (product: ResolvedProduct): Record<string, string> => ({
  ...Object.fromEntries(product.parts.map((part) => [partKeyOf(part), folderHashOf(dirname(part.file))])),
  ...(product.fixtures
    ? { [FIXTURES_KEY]: hashOf({ root: dirname(product.fixtures), files: [product.fixtures] }) }
    : {}),
});

/**
 * The parts, and `fixtures.ts`, a variant replaces whose state in the product differs from the
 * sketch's baseline: changed, added or removed since the sketch was created.
 */
export const conflictsOf = (options: {
  product: ResolvedProduct;
  baseline: Record<string, string>;
  parts: PartFile[];
  fixtures: boolean;
}) => {
  const { product, baseline, parts, fixtures } = options;
  const now = baselineOf(product);

  return [...parts.map(partKeyOf), ...(fixtures ? [FIXTURES_KEY] : [])].filter((key) => now[key] !== baseline[key]);
};

/**
 * The parts, and `fixtures.ts`, any variant of the sketch replaces that changed in the product since its
 * baseline, or `[]` when it records none. `null` while the baseline is current and a merge needs no rebase.
 */
export const staleBaselineOf = (options: {
  product: ResolvedProduct;
  sketch: { dir: string; variants: string[]; baseline?: Record<string, string> };
}): string[] | null => {
  const { product, sketch } = options;

  if (!sketch.baseline) return [];

  const dirs = sketch.variants.map((variant) => resolve(sketch.dir, variant));
  const changed = conflictsOf({
    product,
    baseline: sketch.baseline,
    parts: dirs.flatMap((dir) => partFilesOf(dir).parts),
    fixtures: dirs.some((dir) => fixturesOf(dir) !== null),
  });
  const unique = [...new Set(changed)];

  return unique.length > 0 ? unique : null;
};
