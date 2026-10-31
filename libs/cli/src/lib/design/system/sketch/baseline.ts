import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { DesignProduct } from '../../paths';
import { ASSETS_PREFIX, filesBelow, importedAssetsOf } from '../assets';
import { importedSharedOf, SHARED_PREFIX } from '../imports';
import { fixturesOf, PartFile, partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';

export const FIXTURES_KEY = 'fixtures.ts';

type Imported = { path: string; file: string }[];

const hashOf = (paths: { root: string; files: string[]; assets?: Imported; shared?: Imported }) => {
  const hash = createHash('sha256');

  for (const file of paths.files) hash.update(`${relative(paths.root, file)}\0`).update(readFileSync(file));
  for (const asset of paths.assets ?? [])
    hash.update(`${ASSETS_PREFIX}${asset.path}\0`).update(readFileSync(asset.file));
  for (const shared of paths.shared ?? [])
    hash.update(`${SHARED_PREFIX}${shared.path}\0`).update(readFileSync(shared.file));

  return hash.digest('hex').slice(0, 16);
};

type Owner = { dir: string; config?: Pick<DesignProduct, 'generatedFiles'> };

type HashedProduct = Owner & { base: Owner | null };

const generatedFilesOf = (product: HashedProduct) =>
  new Set(
    [product, product.base].flatMap((owner) =>
      owner ? (owner.config?.generatedFiles ?? []).map((file) => resolve(owner.dir, file)) : [],
    ),
  );

/**
 * The content hash of a part folder together with the bytes of each product `shared/` file it reaches through
 * `@shared/` and each `@assets/` file it or those files import, as `product` resolves them. A part that imports
 * neither hashes as its folder alone. Files the product or its base lists in `generatedFiles` are left out.
 */
export const partHashOf = (options: { product: HashedProduct; dir: string }) => {
  const generated = generatedFilesOf(options.product);
  const files = filesBelow(options.dir).filter((file) => !generated.has(file));
  const shared = importedSharedOf({ product: options.product, files });
  const assets = importedAssetsOf({ product: options.product, files: [...files, ...shared.map(({ file }) => file)] });

  return hashOf({ root: options.dir, files, assets, shared });
};

/**
 * The content hash of each part the product resolves (its folder and the assets it imports), and of its fixture set,
 * under the part key and `fixtures.ts`. A sketch keeps it to tell when a part it replaces changed in the product.
 */
export const baselineOf = (product: ResolvedProduct): Record<string, string> => ({
  ...Object.fromEntries(
    product.parts.map((part) => [partKeyOf(part), partHashOf({ product, dir: dirname(part.file) })]),
  ),
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
