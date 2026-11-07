import { realpathSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { ResolvedProduct } from '../resolve-product';
import { Sketch, sketchesDirOf } from './sketch';
import { spawnPlain } from '../../../plain-output';

const gitIn = (target: string, ...args: string[]) => spawnPlain(['git', ...args], { cwd: target });

const dirsOf = (product: ResolvedProduct) => [product.dir, ...(product.base ? [product.base.dir] : [])];

const below = (path: string, dir: string) => path === dir || path.startsWith(`${dir}${sep}`);

/** The dirty files of the product's folders by absolute path, each with a hash of its content; `null` outside a git checkout. */
export const dirtyFilesOf = (options: { target: string; product: ResolvedProduct }) => {
  const root = gitIn(options.target, 'rev-parse', '--show-toplevel');
  const status = gitIn(
    options.target,
    'status',
    '--porcelain',
    '-z',
    '--no-renames',
    '--untracked-files=all',
    '--',
    ...dirsOf(options.product),
  );

  if (root.status !== 0 || status.status !== 0) return null;

  const top = realpathSync(root.stdout.trim());
  const files = new Map<string, string>();

  for (const entry of status.stdout.split('\0').filter((line) => /^.. /.test(line))) {
    const file = resolve(top, entry.slice(3));
    const hashed = gitIn(options.target, 'hash-object', '--', file);

    files.set(file, hashed.status === 0 ? hashed.stdout.trim() : 'deleted');
  }

  return files;
};

/**
 * Commits what a merge wrote into the product's folders - the files dirty now that were clean or different before,
 * and the merged sketch's own deletion, never another open sketch - as one commit. A failed commit warns and leaves the files as they are.
 */
export const commitMergeResult = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  before: Map<string, string> | null;
}) => {
  const { target, product, sketch, before } = options;
  const after = dirtyFilesOf({ target, product });

  if (!before || !after) return false;

  const productDir = realpathSync(product.dir);
  const sketches = sketchesDirOf(productDir);
  const merged = resolve(productDir, relative(product.dir, sketch.dir));
  const files = [...after]
    .filter(([file, hash]) => before.get(file) !== hash)
    .map(([file]) => file)
    .filter((file) => !below(file, sketches) || below(file, merged));

  if (files.length === 0) return true;

  const added = gitIn(target, 'add', '--all', '--', ...files);
  const committed =
    added.status === 0
      ? gitIn(
          target,
          'commit',
          '-m',
          `feat(repo): Merge ${sketch.target} variant ${options.variant} into ${product.name}`,
          '--',
          ...files,
        )
      : added;

  if (committed.status !== 0)
    console.warn(`Could not commit the merge: ${(committed.stderr || committed.stdout).trim()}`);

  return committed.status === 0;
};
