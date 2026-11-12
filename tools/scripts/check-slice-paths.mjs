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

/**
 * Drops the paths a merge took unchanged from one of `sides` (HEAD, MERGE_HEAD, the clean auto-merge tree).
 * `blob(rev, path)` gives the object id, `null` when absent; rev `''` is the index.
 */
export const pathsChangedByMerge = (paths, blob, sides) =>
  paths.filter((path) => {
    const staged = blob('', path);

    return sides.every((side) => staged !== blob(side, path));
  });

export const formatSlicePathsFile = (name, paths, now) =>
  `# slice: ${name}\n# written: ${new Date(now).toISOString()}\n${paths.join('\n')}\n`;

const writtenAtOf = (content, mtimeMs) => {
  const written = /^#\s*written:\s*(\S+)/m.exec(content)?.[1];

  return written && !Number.isNaN(Date.parse(written)) ? Date.parse(written) : mtimeMs;
};

/** Splits a slice-paths file into one block per `# slice:` header; text before the first header is one unnamed block. */
export const parseSliceBlocks = (content, mtimeMs) =>
  content
    .split(/^(?=#\s*slice:)/m)
    .filter((text) => parseSlicePaths(text).length > 0)
    .map((text) => ({
      name: /^#\s*slice:\s*(.+)$/m.exec(text)?.[1].trim(),
      writtenAt: writtenAtOf(text, mtimeMs),
      text: text.endsWith('\n') ? text : `${text}\n`,
    }));

/** Keeps every fresh block of other slices, so a second slice in the same checkout does not drop the first one. */
export const upsertSliceBlock = (content, mtimeMs, name, paths, now) =>
  [
    ...parseSliceBlocks(content, mtimeMs)
      .filter((block) => block.name !== name && now - block.writtenAt <= STALE_AFTER_MS)
      .map((block) => block.text),
    formatSlicePathsFile(name, paths, now),
  ].join('');

/** The blocks the check applies: every fresh block, or all blocks when none is fresh. */
export const activeSliceBlocks = (content, mtimeMs, now) => {
  const blocks = parseSliceBlocks(content, mtimeMs);
  const fresh = blocks.filter((block) => now - block.writtenAt <= STALE_AFTER_MS);

  return fresh.length > 0 ? fresh : blocks;
};

export const describeSource = ({ env, file }, now) => {
  if (env) return { text: 'env ETHLETE_SLICE_PATHS', stale: false };

  const blocks = parseSliceBlocks(file.content, file.mtimeMs);
  const names = blocks.map((block) => block.name).filter(Boolean);
  const writtenAt = Math.max(...blocks.map((block) => block.writtenAt), Number.NEGATIVE_INFINITY);
  const ageMs = Math.max(0, now - (Number.isFinite(writtenAt) ? writtenAt : file.mtimeMs));
  const minutes = Math.round(ageMs / 60000);
  const age = minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} h`;
  const stale = ageMs > STALE_AFTER_MS;
  const named =
    names.length === 0 ? '' : `, slice${names.length > 1 ? 's' : ''} ${names.map((n) => `"${n}"`).join(', ')}`;
  const label = `file ${file.path}${named}, written ${age} ago`;

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

const gitBlob = (rev, path) => {
  const result = git(['rev-parse', '--verify', '--quiet', `${rev}:${path}`]);

  return result.status === 0 ? result.stdout.trim() : null;
};

const isMerging = () => git(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).status === 0;

const mergeSides = () => {
  const autoMerge = git(['merge-tree', '--write-tree', 'HEAD', 'MERGE_HEAD']).stdout.split('\n')[0].trim();

  return ['HEAD', 'MERGE_HEAD', ...(/^[0-9a-f]{40,64}$/.test(autoMerge) ? [autoMerge] : [])];
};

const slicePathsFile = () => {
  const file = git(['rev-parse', '--git-path', 'slice-paths']);

  return file.status === 0 ? file.stdout.trim() : '';
};

const readSource = () => {
  const fromEnv = process.env.ETHLETE_SLICE_PATHS;

  if (fromEnv) return { patterns: parseSlicePaths(fromEnv), source: { env: true } };

  const path = slicePathsFile();

  if (!path || !existsSync(path)) return { patterns: [], source: null };

  const mtimeMs = statSync(path).mtimeMs;
  const content = activeSliceBlocks(readFileSync(path, 'utf8'), mtimeMs, Date.now())
    .map((block) => block.text)
    .join('');

  return { patterns: parseSlicePaths(content), source: { file: { path, content, mtimeMs } } };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [flag, name, ...paths] = process.argv.slice(2);

  if (flag === '--set') {
    if (!name || paths.length === 0) {
      console.error('usage: check-slice-paths.mjs --set "<slice name>" <path> [<path>...]');
      process.exit(1);
    }

    const file = slicePathsFile();
    const exists = existsSync(file);

    writeFileSync(
      file,
      upsertSliceBlock(
        exists ? readFileSync(file, 'utf8') : '',
        exists ? statSync(file).mtimeMs : 0,
        name,
        paths,
        Date.now(),
      ),
    );
  } else {
    const { patterns, source } = readSource();

    if (patterns.length > 0) {
      const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']).stdout.split('\n').filter(Boolean);
      const own = isMerging() ? pathsChangedByMerge(staged, gitBlob, mergeSides()) : staged;
      const now = Date.now();
      const warning = warningFor(pathsOutsideSlice(own, patterns), patterns, describeSource(source, now));

      if (warning) console.warn(warning);
    }
  }
}
