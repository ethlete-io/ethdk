import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DESIGN = '.ethlete/design';

const productsOf = (root: string) =>
  existsSync(join(root, DESIGN))
    ? readdirSync(join(root, DESIGN), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

/**
 * Replaces each product's `sketches` folder in the pre-push clone `to` with the working tree's in `from`, so the live
 * check counts the open sketches that stay uncommitted until merged. No other uncommitted file reaches the clone.
 */
export const copyOpenSketches = ({ from, to }: { from: string; to: string }) => {
  if (!existsSync(join(from, DESIGN))) return;

  for (const product of new Set([...productsOf(from), ...productsOf(to)])) {
    const source = join(from, DESIGN, product, 'sketches');
    const target = join(to, DESIGN, product, 'sketches');

    rmSync(target, { recursive: true, force: true });

    if (existsSync(source)) cpSync(source, target, { recursive: true });
  }
};
