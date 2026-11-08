import { existsSync, realpathSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { ResolvedProduct } from '../resolve-product';
import { Sketch, sketchesDirOf } from './sketch';
import { PlainResult, spawnPlain } from '../../../plain-output';

type GitCall = { args: string[]; input?: string };
type GitFlow<T> = Generator<GitCall, T, PlainResult>;

const runSync = <T>(target: string, flow: GitFlow<T>) => {
  let step = flow.next();

  while (!step.done)
    step = flow.next(spawnPlain(['git', ...step.value.args], { cwd: target, input: step.value.input }));

  return step.value;
};

const dirsOf = (product: ResolvedProduct) => [product.dir, ...(product.base ? [product.base.dir] : [])];

const below = (path: string, dir: string) => path === dir || path.startsWith(`${dir}${sep}`);

function* dirtyFilesFlow(product: ResolvedProduct): GitFlow<Map<string, string> | null> {
  const root = yield { args: ['rev-parse', '--show-toplevel'] };
  const status = yield {
    args: ['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', ...dirsOf(product)],
  };

  if (root.status !== 0 || status.status !== 0) return null;

  const top = realpathSync(root.stdout.trim());
  const files = status.stdout
    .split('\0')
    .filter((line) => /^.. /.test(line))
    .map((entry) => resolve(top, entry.slice(3)));
  const present = files.filter((file) => existsSync(file));
  const hashed =
    present.length > 0 ? yield { args: ['hash-object', '--stdin-paths'], input: present.join('\n') } : null;
  const hashes = hashed?.status === 0 ? hashed.stdout.trim().split('\n') : [];

  return new Map(files.map((file) => [file, hashes[present.indexOf(file)] ?? 'deleted']));
}

function* commitFlow(options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  before: Map<string, string> | null;
}): GitFlow<boolean> {
  const { product, sketch, before } = options;
  const after = yield* dirtyFilesFlow(product);

  if (!before || !after) return false;

  const productDir = realpathSync(product.dir);
  const sketches = sketchesDirOf(productDir);
  const merged = resolve(productDir, relative(product.dir, sketch.dir));
  const files = [...after]
    .filter(([file, hash]) => before.get(file) !== hash)
    .map(([file]) => file)
    .filter((file) => !below(file, sketches) || below(file, merged));

  if (files.length === 0) return true;

  const added = yield { args: ['add', '--all', '--', ...files] };
  const committed =
    added.status === 0
      ? yield {
          args: [
            'commit',
            '-m',
            `feat(repo): Merge ${sketch.target} variant ${options.variant} into ${product.name}`,
            '--',
            ...files,
          ],
        }
      : added;

  if (committed.status !== 0)
    console.warn(`Could not commit the merge: ${(committed.stderr || committed.stdout).trim()}`);

  return committed.status === 0;
}

type CommitOptions = {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  before: Map<string, string> | null;
};

/** The dirty files of the product's folders by absolute path, each with a hash of its content; `null` outside a git checkout. */
export const dirtyFilesOfSync = (options: { target: string; product: ResolvedProduct }) =>
  runSync(options.target, dirtyFilesFlow(options.product));

/**
 * Commits what a merge wrote into the product's folders - the files dirty now that were clean or different before,
 * and the merged sketch's own deletion, never another open sketch - as one commit. A failed commit warns and leaves the files as they are.
 */
export const commitMergeResultSync = (options: CommitOptions) => runSync(options.target, commitFlow(options));
