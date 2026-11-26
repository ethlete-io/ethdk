import { cpSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { ruleProblemsOf } from '../check-system';
import { SHARED_FOLDER } from '../imports';
import { partFilesOf } from '../product';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { carryShared, sharedPlanOf, sketchSharedFilesOf } from './merge-shared';
import { SketchedProduct } from './overlay';
import { Sketch, variantDirOf } from './sketch';

/**
 * The rule problems of the files a merge of the variant carries from the sketch's `shared/` into a target's folder,
 * found where the merge puts them. Each names the sketch file to fix and `mergedFile`, the path it gets in the product.
 */
export const mergedLayoutProblemsOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  overlaid: SketchedProduct;
}): { problem: Problem; mergedFile: string }[] => {
  const { product, sketch, variant, overlaid } = options;
  const { parts } = partFilesOf(variantDirOf(sketch, variant));
  const plan = sharedPlanOf({ sketch, variant, parts, product });

  if (typeof plan === 'string' || plan.carry.length === 0) return [];

  const layout = mkdtempSync(join(tmpdir(), 'cli-design-merged-layout-'));
  const sources = sketchSharedFilesOf(sketch, variant);

  try {
    const carried = plan.carry.flatMap(({ targetDir, paths }) => {
      const key = relative(product.dir, targetDir);
      const part = overlaid.parts.find((candidate) => partKeyOf(candidate) === key);

      if (!part) return [];

      const laidDir = resolve(layout, key);

      cpSync(dirname(part.file), laidDir, { recursive: true });
      carryShared({ sketch, variant, targetDir: laidDir, paths, product });

      const file = resolve(laidDir, relative(dirname(part.file), part.file));
      const css = part.css ? resolve(laidDir, relative(dirname(part.file), part.css)) : undefined;
      const laid: ResolvedPart = { ...part, file, css, source: readFileSync(file, 'utf8') };

      return [{ key, targetDir, laid }];
    });
    const laidParts = new Map(carried.map(({ key, laid }) => [key, laid]));
    const found = ruleProblemsOf({
      ...overlaid,
      parts: overlaid.parts.map((part) => laidParts.get(partKeyOf(part)) ?? part),
    });

    return carried.flatMap(({ key, targetDir }) => {
      const shared = resolve(layout, key, SHARED_FOLDER);

      return found.flatMap((problem) => {
        const path = relative(shared, problem.file);
        const source = path.startsWith('..') ? undefined : sources.get(path);

        return source
          ? [{ problem: { ...problem, file: source }, mergedFile: resolve(targetDir, SHARED_FOLDER, path) }]
          : [];
      });
    });
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
};
