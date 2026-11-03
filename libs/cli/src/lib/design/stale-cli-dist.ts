import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, sep } from 'path';
import { BUILD_INFO_FILE } from './stamp';

export const CLI_REBUILD_COMMAND = 'NX_NO_CLOUD=true npx nx build cli';

const newestMtimeOf = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((newest, entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return Math.max(newest, newestMtimeOf(path));

    return entry.isFile() ? Math.max(newest, statSync(path).mtimeMs) : newest;
  }, 0);

const builtAtOf = (distDir: string) => {
  try {
    const time = Date.parse(
      (JSON.parse(readFileSync(join(distDir, BUILD_INFO_FILE), 'utf8')) as { builtAt?: string }).builtAt ?? '',
    );

    if (!Number.isNaN(time)) return time;
  } catch {
    /* no stamp: fall through to the directory time */
  }

  try {
    return statSync(distDir).mtimeMs;
  } catch {
    return null;
  }
};

/**
 * The WARN line when the built cli at `distDir` is older than the source in `repoRoot/libs/cli/src`, else null.
 * An installed package has no such source folder, so it never warns.
 */
export const staleCliDistWarning = (options: { distDir: string; repoRoot: string }): string | null => {
  const sourceDir = join(options.repoRoot, 'libs/cli/src');

  if (!existsSync(sourceDir)) return null;

  const builtAt = builtAtOf(options.distDir);

  if (builtAt === null) return null;

  const newest = newestMtimeOf(sourceDir);

  if (newest <= builtAt) return null;

  return `WARN: the built cli is older than libs/cli/src (built ${new Date(builtAt).toISOString()}, newest source ${new Date(newest).toISOString()}); a fix in the source may not be in this build. Rebuild: ${CLI_REBUILD_COMMAND}`;
};

/** The warning for the cli this process runs from, or null outside a repo checkout's `dist/libs/cli`. */
export const runningCliStaleWarning = (): string | null => {
  const distDir = resolve(__dirname, '../../../');

  if (!distDir.endsWith(`${sep}dist${sep}libs${sep}cli`)) return null;

  return staleCliDistWarning({ distDir, repoRoot: resolve(distDir, '../../..') });
};
