import { posix } from 'path';
import { DesignHarness } from '../paths';

const isRepoPath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.trim() === path &&
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !posix.normalize(path).startsWith('..');

/** Why a product's `harness` entry is unusable, or `null` when it is a valid `{ app, map }` of repo paths. */
export const harnessProblemOf = (harness: unknown): string | null => {
  if (typeof harness !== 'object' || harness === null || Array.isArray(harness))
    return `harness must be { "app": "<repo path of the app>", "map": "<repo path of the generated .ts file>" }`;

  const { app, map } = harness as Partial<Record<keyof DesignHarness, unknown>>;

  if (!isRepoPath(app)) return `harness.app must be a repo path, got ${JSON.stringify(app)}`;
  if (!isRepoPath(map) || !map.endsWith('.ts') || map.endsWith('.d.ts'))
    return `harness.map must be the repo path of a .ts file, got ${JSON.stringify(map)}`;

  const inside = posix.relative(posix.normalize(app), posix.normalize(map));

  if (inside.startsWith('..')) return `harness.map ${map} must lie inside harness.app ${app}`;

  return null;
};
