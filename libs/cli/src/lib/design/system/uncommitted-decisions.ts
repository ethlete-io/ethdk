import { git } from '../git-reader';
import { ResolvedProduct } from './resolve-product';

const DECISION_FILES = ['merged.json', ':(glob)sketches/*/sketch.json'];

const gitLines = (cwd: string, args: string[]) =>
  git([...args, '--', ...DECISION_FILES], { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter(Boolean);

/** The decision files of a product, relative to its folder, that differ from HEAD or are untracked; none outside git. */
export const uncommittedDecisionsOf = (product: ResolvedProduct): string[] => {
  try {
    return [
      ...new Set([
        ...gitLines(product.dir, ['diff', '--name-only', '--relative', 'HEAD']),
        ...gitLines(product.dir, ['ls-files', '--others', '--exclude-standard']),
      ]),
    ].sort();
  } catch {
    return [];
  }
};

export const uncommittedDecisionsWarningOf = (product: ResolvedProduct): string | null => {
  const files = uncommittedDecisionsOf(product);

  return files.length === 0
    ? null
    : `WARNING UNCOMMITTED-DECISIONS ${product.name}: ${files.join(', ')} differ from HEAD - Studio or Tom commits them`;
};
