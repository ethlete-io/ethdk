import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';
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
      execFileSync('git', args, {
        cwd: top,
        encoding: 'utf8',
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
