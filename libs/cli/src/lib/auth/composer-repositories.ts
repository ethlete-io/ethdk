import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const urlOf = (entry: unknown) =>
  typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>)['url'] : undefined;

/**
 * The git urls a checkout's composer.json pulls packages from. These are the repositories a token is
 * needed for; the API's own repository is not one of them, because the developer already has it.
 */
export const composerGitRepositories = (repoPath: string): string[] => {
  const path = join(repoPath, 'composer.json');

  if (!existsSync(path)) return [];

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }

  const declared = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const repositories = declared['repositories'];
  // composer accepts both a list and a name-keyed map here.
  const entries = Array.isArray(repositories)
    ? repositories
    : typeof repositories === 'object' && repositories !== null
      ? Object.values(repositories)
      : [];

  return entries.map(urlOf).filter((url): url is string => typeof url === 'string');
};
