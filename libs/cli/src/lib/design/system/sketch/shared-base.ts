import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { gitStatusOf } from '../../git-reader';
import { filesBelow } from '../assets';
import { SHARED_FOLDER } from '../imports';
import { partKeyOf, ResolvedProduct } from '../resolve-product';

export type StaleSharedCopy = { copy: string; base: string; commit: string };

const hashOf = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);

const partDirOf = (product: ResolvedProduct, key: string) => {
  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  return part ? dirname(part.file) : null;
};

const baseFileOf = (product: ResolvedProduct, key: string) => {
  const [layer, name, ...path] = key.split('/');
  const dir = partDirOf(product, `${layer}/${name}`);

  return dir ? resolve(dir, ...path) : null;
};

/**
 * The content hash of each file in the `shared/` folder of the `targets` parts, keyed `<layer>/<name>/shared/<path>`:
 * the base files a new sketch lifts into its own `shared/` folder.
 */
export const sharedBaseOf = (product: ResolvedProduct, targets: string[]): Record<string, string> =>
  Object.fromEntries(
    targets.flatMap((key) => {
      const dir = partDirOf(product, key);
      const shared = dir ? resolve(dir, SHARED_FOLDER) : null;

      return shared
        ? filesBelow(shared).map((file) => [
            `${key}/${SHARED_FOLDER}/${relative(shared, file).split(sep).join('/')}`,
            hashOf(file),
          ])
        : [];
    }),
  );

/** The hashes of the recorded base files as the product holds them now; a base file that is gone drops out. */
export const sharedBaseNowOf = (product: ResolvedProduct, recorded: Record<string, string>) =>
  Object.fromEntries(
    Object.keys(recorded).flatMap((key) => {
      const file = baseFileOf(product, key);

      return file && existsSync(file) ? [[key, hashOf(file)]] : [];
    }),
  );

const commitOf = (file: string) => {
  if (!existsSync(file)) return 'removed';

  const cwd = dirname(file);
  const dirty = gitStatusOf(['status', '--porcelain', '--', file], { cwd });

  if (dirty.status !== 0) return 'outside git';
  if (dirty.stdout.trim() !== '') return 'uncommitted';

  return gitStatusOf(['log', '-1', '--format=%h', '--', file], { cwd }).stdout.trim() || 'uncommitted';
};

/**
 * Each copy in the sketch's `shared/` folder whose base file changed since the sketch lifted or rebased it, with the
 * commit that changed it last: `uncommitted` while the change is not committed, `removed` when the file is gone.
 */
export const staleSharedCopiesOf = (
  product: ResolvedProduct,
  sharedBase: Record<string, string> | undefined,
): StaleSharedCopy[] =>
  Object.entries(sharedBase ?? {}).flatMap(([key, hash]) => {
    const file = baseFileOf(product, key);

    if (file && existsSync(file) && hashOf(file) === hash) return [];

    return [{ copy: key.split('/').slice(2).join('/'), base: key, commit: file ? commitOf(file) : 'removed' }];
  });
