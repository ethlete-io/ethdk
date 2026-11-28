import { git as gitText } from '../../git-reader';
import { createHash } from 'crypto';
import { mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join, relative, sep } from 'path';
import { gitTopOf } from '../../git-top';
import { ResolvedProduct } from '../resolve-product';

const posix = (path: string) => path.split(sep).join('/');

/**
 * The git tree of the product's folders, and of its base's inside the repo, as the working tree holds them now, its
 * sketches left out, or `null` outside git. Written to the object store through a scratch index, so the checkout's own
 * index stays as it is; `sketch rebase` finds a baseline there that no commit holds.
 */
export const baselineTreeOf = (options: {
  product: ResolvedProduct;
  sketchesDirOf: (productDir: string) => string;
}): string | null => {
  const { product, sketchesDirOf } = options;
  const scratch = mkdtempSync(join(tmpdir(), 'et-sketch-baseline-tree-'));

  try {
    const top = gitTopOf(product.dir);
    const inRepo = (dir: string) => !relative(top, dir).startsWith('..');
    const owners = [product.dir, ...(product.base && inRepo(product.base.dir) ? [product.base.dir] : [])];
    const git = (args: string[]) =>
      gitText(args, {
        cwd: top,
        env: { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

    git([
      'add',
      '--all',
      '--',
      ...owners.map((dir) => posix(relative(top, dir)) || '.'),
      ...owners.map((dir) => `:(exclude)${posix(relative(top, sketchesDirOf(dir)))}`),
    ]);

    return git(['write-tree']).trim();
  } catch {
    return null;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

/** The ref that keeps a sketch's baseline tree from `git gc`, one per sketch folder of this checkout. */
export const baselineTreeRefOf = (sketchDir: string) => {
  const dir = realpathSync(sketchDir);
  const place = createHash('sha1').update(dirname(dir)).digest('hex').slice(0, 12);

  return `refs/ethlete/sketch/${place}/${basename(dir)}`;
};

const gitIn = (dir: string, args: string[]) => {
  try {
    gitText(args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return;
  }
};

/** Points the sketch's ref at `tree`, so `git gc` keeps the tree as long as the sketch exists. */
export const keepBaselineTree = (options: { sketchDir: string; tree: string }) =>
  gitIn(options.sketchDir, ['update-ref', baselineTreeRefOf(options.sketchDir), options.tree]);

/** Deletes the sketch's baseline tree ref; call it before the sketch folder goes. */
export const dropBaselineTree = (sketchDir: string) =>
  gitIn(sketchDir, ['update-ref', '-d', baselineTreeRefOf(sketchDir)]);
