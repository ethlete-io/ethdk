import { gitStatusOf } from './git-reader';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { cliSourceHash } from '../source-hash';
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

// Must match PINNED_FILE in tools/scripts/studio-code.mjs.
const PINNED_COMMIT_FILE = 'pinned-commit';

const BUILT_PATHS = [
  ':(top)libs/cli/src',
  ':(top)libs/cli/design',
  ':(top)libs/cli/playwright',
  ':(top,exclude,glob)libs/cli/**/*.spec.ts',
  ':(top,exclude,glob)libs/cli/**/*.md',
];

const readOrNull = (path: string) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const buildInfoOf = (distDir: string): { commit?: unknown; sourceHash?: unknown } => {
  try {
    return JSON.parse(readOrNull(join(distDir, BUILD_INFO_FILE)) ?? '{}') as { commit?: unknown; sourceHash?: unknown };
  } catch {
    return {};
  }
};

/** The commit the cli at `distDir` was built from: the et:design copy's pin, else the build stamp. */
export const buildCommitOf = (distDir: string): string | null => {
  const pinned = readOrNull(join(distDir, PINNED_COMMIT_FILE))?.trim();

  if (pinned) return pinned;

  const { commit } = buildInfoOf(distDir);

  return typeof commit === 'string' && commit ? commit : null;
};

const sourceRootAbove = (distDir: string, dir = dirname(distDir)): string | null => {
  const cliRoot = join(dir, 'libs', 'cli');

  if (cliRoot !== distDir && existsSync(join(cliRoot, 'src'))) return cliRoot;

  return dirname(dir) === dir ? null : sourceRootAbove(distDir, dirname(dir));
};

const builtFromCurrentSources = (distDir: string) => {
  const cliRoot = sourceRootAbove(distDir);
  const { sourceHash } = buildInfoOf(distDir);

  return !!cliRoot && typeof sourceHash === 'string' && sourceHash === cliSourceHash(cliRoot);
};

/**
 * The WARN line when the built sources of `libs/cli` differ from the commit the cli at `distDir` was built from,
 * committed or not, else null. Silent for an installed package, an unknown commit, or no git checkout.
 */
export const builtCliChangedWarning = (options: { distDir: string }): string | null => {
  const distDir = resolve(options.distDir);

  if (distDir.split(sep).includes('node_modules')) return null;

  const commit = buildCommitOf(distDir);

  if (!commit) return null;

  const diff = gitStatusOf(['-C', distDir, 'diff', '--quiet', commit, '--', ...BUILT_PATHS], { stdio: 'ignore' });

  if (diff.status !== 1 || builtFromCurrentSources(distDir)) return null;

  return `WARN: this cli was built from ${commit.slice(0, 9)}; libs/cli has commits or uncommitted changes since, so a fix in the source may not be in this build. Rebuild: ${CLI_REBUILD_COMMAND}`;
};

/** The line that names the cli build at `distDir` and the commit it was built from. */
export const cliBuildLineOf = (options: { distDir: string }) => {
  const commit = buildCommitOf(options.distDir);

  return `cli: runs the build at ${options.distDir} (${commit ? `built from ${commit.slice(0, 9)}` : 'no build commit'})`;
};

/** The line that names the cli build this process runs from. */
export const runningCliBuildLine = () => cliBuildLineOf({ distDir: resolve(__dirname, '../../../') });

/** The warning for the cli this process runs from, or null when it is no build inside a repo checkout. */
export const runningCliStaleWarning = (): string | null => {
  const distDir = resolve(__dirname, '../../../');

  if (buildCommitOf(distDir)) return builtCliChangedWarning({ distDir });

  if (!distDir.endsWith(`${sep}dist${sep}libs${sep}cli`)) return null;

  return staleCliDistWarning({ distDir, repoRoot: resolve(distDir, '../../..') });
};
