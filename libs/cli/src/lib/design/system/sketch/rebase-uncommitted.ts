import { existsSync, readFileSync, realpathSync } from 'fs';
import { basename, resolve } from 'path';
import { gitStatusOf } from '../../git-reader';

/** Written by the post-commit hook: per sketch folder name, the commit whose sketch rebase it could not commit. */
export const REBASE_UNCOMMITTED_FILE = 'rebase-uncommitted.json';

type Recorded = Record<string, { commit: string }>;

const recordedOf = (productDir: string): Recorded => {
  const file = resolve(productDir, REBASE_UNCOMMITTED_FILE);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' ? (parsed as Recorded) : {};
  } catch {
    return {};
  }
};

/** Per sketch dir, the commit whose rebase of it is still uncommitted; a recorded sketch whose files are clean in git is left out. */
export const rebaseUncommittedOf = (options: { productDir: string; dirs: readonly string[] }) => {
  const recorded = recordedOf(options.productDir);
  const dirs = options.dirs.filter((dir) => typeof recorded[basename(dir)]?.commit === 'string');
  const found = new Map<string, { commit: string }>();

  if (dirs.length === 0) return found;

  const status = gitStatusOf(['status', '--porcelain', '-z', '--untracked-files=all', '--', ...dirs], {
    cwd: options.productDir,
  });

  if (status.status !== 0) return found;

  const root = gitStatusOf(['rev-parse', '--show-toplevel'], { cwd: options.productDir }).stdout.trim();
  const dirty = status.stdout
    .split('\0')
    .filter((entry) => /^.. /u.test(entry))
    .map((entry) => resolve(root, entry.slice(3)));

  for (const dir of dirs) {
    const commit = recorded[basename(dir)]?.commit;
    const real = realpathSync(dir);

    if (commit && dirty.some((file) => file.startsWith(`${real}/`))) found.set(dir, { commit });
  }

  return found;
};
