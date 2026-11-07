import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ALWAYS_ALLOWED = ['.changeset/', 'plans/'];

const globToRegExp = (glob) => {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/?/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?');

  return new RegExp(`^${source}$`);
};

export const parseSlicePaths = (text) =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .split(/[\s,]+/)
    .filter(Boolean);

export const isAllowedPath = (path, patterns) =>
  [...ALWAYS_ALLOWED, ...patterns].some((pattern) => {
    if (/[*?]/.test(pattern)) return globToRegExp(pattern).test(path);

    const dir = pattern.replace(/\/$/, '');

    return path === dir || path.startsWith(`${dir}/`);
  });

export const pathsOutsideSlice = (paths, patterns) =>
  patterns.length === 0 ? [] : paths.filter((path) => !isAllowedPath(path, patterns));

export const warningFor = (outside, patterns) =>
  outside.length === 0
    ? ''
    : `slice paths: ${outside.length} staged path${outside.length === 1 ? ' is' : 's are'} outside the slice (${patterns.join(', ')}):\n${outside.map((path) => `  ${path}`).join('\n')}\nIf this is intended, ignore this warning; otherwise unstage them. The commit is not blocked.`;

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });

const readPatterns = () => {
  const fromEnv = process.env.ETHLETE_SLICE_PATHS;

  if (fromEnv) return parseSlicePaths(fromEnv);

  const file = git(['rev-parse', '--git-path', 'slice-paths']);
  const path = file.status === 0 ? file.stdout.trim() : '';

  return path && existsSync(path) ? parseSlicePaths(readFileSync(path, 'utf8')) : [];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const patterns = readPatterns();

  if (patterns.length > 0) {
    const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
    const warning = warningFor(pathsOutsideSlice(staged.stdout.split('\n').filter(Boolean), patterns), patterns);

    if (warning) console.warn(warning);
  }
}
