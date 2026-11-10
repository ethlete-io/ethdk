import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ALWAYS_ALLOWED = ['.changeset/', 'plans/'];
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

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

export const formatSlicePathsFile = (name, paths, now) =>
  `# slice: ${name}\n# written: ${new Date(now).toISOString()}\n${paths.join('\n')}\n`;

export const describeSource = ({ env, file }, now) => {
  if (env) return { text: 'env ETHLETE_SLICE_PATHS', stale: false };

  const name = /^#\s*slice:\s*(.+)$/m.exec(file.content)?.[1].trim();
  const written = /^#\s*written:\s*(\S+)/m.exec(file.content)?.[1];
  const writtenAt = written && !Number.isNaN(Date.parse(written)) ? Date.parse(written) : file.mtimeMs;
  const ageMs = Math.max(0, now - writtenAt);
  const minutes = Math.round(ageMs / 60000);
  const age = minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} h`;
  const stale = ageMs > STALE_AFTER_MS;
  const label = `file ${file.path}${name ? `, slice "${name}"` : ''}, written ${age} ago`;

  return { text: stale ? `${label} - stale` : label, stale };
};

export const warningFor = (outside, patterns, source) => {
  if (outside.length === 0) return '';

  const stale = source?.stale
    ? `The slice-paths file is stale (older than 2 h) and may belong to an earlier slice. Rewrite it with: node tools/scripts/check-slice-paths.mjs --set "<slice name>" <path>...\n`
    : '';
  const from = source ? ` from ${source.text}` : '';

  return `${stale}slice paths${from}: ${outside.length} staged path${outside.length === 1 ? ' is' : 's are'} outside the slice (${patterns.join(', ')}):\n${outside.map((path) => `  ${path}`).join('\n')}\nIf this is intended, ignore this warning; otherwise unstage them. The commit is not blocked.`;
};

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });

const slicePathsFile = () => {
  const file = git(['rev-parse', '--git-path', 'slice-paths']);

  return file.status === 0 ? file.stdout.trim() : '';
};

const readSource = () => {
  const fromEnv = process.env.ETHLETE_SLICE_PATHS;

  if (fromEnv) return { patterns: parseSlicePaths(fromEnv), source: { env: true } };

  const path = slicePathsFile();

  if (!path || !existsSync(path)) return { patterns: [], source: null };

  const content = readFileSync(path, 'utf8');

  return { patterns: parseSlicePaths(content), source: { file: { path, content, mtimeMs: statSync(path).mtimeMs } } };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [flag, name, ...paths] = process.argv.slice(2);

  if (flag === '--set') {
    if (!name || paths.length === 0) {
      console.error('usage: check-slice-paths.mjs --set "<slice name>" <path> [<path>...]');
      process.exit(1);
    }

    writeFileSync(slicePathsFile(), formatSlicePathsFile(name, paths, Date.now()));
  } else {
    const { patterns, source } = readSource();

    if (patterns.length > 0) {
      const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']);
      const now = Date.now();
      const warning = warningFor(
        pathsOutsideSlice(staged.stdout.split('\n').filter(Boolean), patterns),
        patterns,
        describeSource(source, now),
      );

      if (warning) console.warn(warning);
    }
  }
}
