import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { spawnPlain } from '@ethlete/cli/src/lib/plain-output';
import { ResolvedProduct } from '../resolve-product';

const SCRIPT = 'tools/scripts/generate-studio-themes.mjs';

const OUTPUT_DIR = 'apps/ethlete-studio/src';

/**
 * Runs the Studio theme generator after a merge of `foundations/colors` into `studio` and answers the generated files it
 * changed, as absolute paths, so the merge commit holds them. Any other merge answers none; a failing generator warns.
 */
export const regenerateStudioThemesOf = (options: {
  target: string;
  product: ResolvedProduct;
  parts: readonly string[];
}): string[] => {
  const { target, product, parts } = options;
  const script = join(target, SCRIPT);

  if (product.name !== 'studio' || !parts.includes('foundations/colors') || !existsSync(script)) return [];

  const run = spawnPlain([process.execPath, script], { cwd: target });

  if (run.status !== 0) {
    console.warn(
      `merged, but the Studio themes are stale, run yarn studio:themes: ${(run.stderr || run.stdout).trim()}`,
    );

    return [];
  }

  const status = spawnPlain(
    ['git', '--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all', '--', OUTPUT_DIR],
    {
      cwd: target,
    },
  );

  return status.stdout
    .split('\0')
    .filter((line) => /^.. /.test(line))
    .map((line) => resolve(target, line.slice(3)));
};
