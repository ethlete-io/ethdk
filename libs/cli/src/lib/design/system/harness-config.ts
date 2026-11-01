import { existsSync, readFileSync } from 'fs';
import { posix, resolve } from 'path';
import { DesignHarness } from '../paths';

const isRepoPath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.trim() === path &&
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !posix.normalize(path).startsWith('..');

/** Why a product's `harness` entry is unusable, or `null` when it is a valid `{ app, map, shared? }` of repo paths. */
export const harnessProblemOf = (harness: unknown): string | null => {
  if (typeof harness !== 'object' || harness === null || Array.isArray(harness))
    return `harness must be { "app": "<repo path of the app>", "map": "<repo path of the generated .ts file>" }`;

  const { app, map, shared } = harness as Partial<Record<keyof DesignHarness, unknown>>;

  if (!isRepoPath(app)) return `harness.app must be a repo path, got ${JSON.stringify(app)}`;
  if (!isRepoPath(map) || !map.endsWith('.ts') || map.endsWith('.d.ts'))
    return `harness.map must be the repo path of a .ts file, got ${JSON.stringify(map)}`;

  const inside = posix.relative(posix.normalize(app), posix.normalize(map));

  if (inside.startsWith('..')) return `harness.map ${map} must lie inside harness.app ${app}`;

  if (shared === undefined) return null;
  if (!Array.isArray(shared)) return `harness.shared must be a list of repo paths, got ${JSON.stringify(shared)}`;

  const outside = shared.find(
    (path) => !isRepoPath(path) || posix.relative(posix.normalize(app), posix.normalize(path)).startsWith('..'),
  );

  if (outside !== undefined)
    return `harness.shared ${JSON.stringify(outside)} must be a repo path inside harness.app ${app}`;

  return null;
};

/** The repo path of the first global stylesheet the harness app's `project.json` builds with, or `null`. */
export const appStylesheetOf = (options: { target: string; app: string }): string | null => {
  const project = resolve(options.target, options.app, 'project.json');

  if (!existsSync(project)) return null;

  const styles = (
    JSON.parse(readFileSync(project, 'utf8')) as { targets?: { build?: { options?: { styles?: unknown } } } }
  ).targets?.build?.options?.styles;
  const first = Array.isArray(styles) ? styles.find((style) => typeof style === 'string') : undefined;

  return first ?? null;
};
