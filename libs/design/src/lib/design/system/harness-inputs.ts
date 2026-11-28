import { readFileSync } from 'fs';
import { posix } from 'path';
import ts from 'typescript';

type Paths = Record<string, string[]>;

const SCANNED = /\.(?:[cm]?[jt]s|css|scss|html)$/u;
const SCRIPT = /\.[cm]?[jt]s$/u;
const UNBUILT =
  /(?:\.(?:spec|test|stories)\.[cm]?[jt]s|(?:^|\/)(?:test-setup|(?:eslint|vite|vitest|jest|playwright|karma)\.config)\.[cm]?[jt]s)$|(?:^|\/)(?:e2e|src-tauri)\//u;
const SPECIFIER = /["'`]([^"'`\s]+)["'`]/gu;
const RELATIVE = /["'`](\.{1,2}\/[^"'`\s]*)["'`]/gu;
const SUFFIXES = ['', '.ts', '.mts', '.js', '.mjs', '.css', '.scss', '.json', '/index.ts', '/index.js'];
const CONFIGS = /(?:^|\/)(?:tsconfig[^/]*\.json|project\.json|package\.json)$/u;

const specifiersBySha = new Map<string, string[]>();

const scannedOf = (path: string, source: string) =>
  SCRIPT.test(path)
    ? [
        ...ts.preProcessFile(source, true, true).importedFiles.map((file) => file.fileName),
        ...[...source.matchAll(RELATIVE)].map((match) => match[1] as string),
      ]
    : [...source.matchAll(SPECIFIER)].map((match) => match[1] as string);

const specifiersOf = (options: { path: string; sha: string; read: () => string }) => {
  const { path, sha, read } = options;
  let found = specifiersBySha.get(sha);

  if (!found) {
    found = [...new Set(scannedOf(path, read()))];
    specifiersBySha.set(sha, found);
  }

  return found;
};

const jsonOf = (path: string, read: (path: string) => string) => {
  try {
    return ts.parseConfigFileTextToJson(path, read(path)).config as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
};

const pathsOf = (options: { configs: string[]; read: (path: string) => string; has: (path: string) => boolean }) => {
  const paths: { pattern: string; targets: string[] }[] = [];

  for (const config of options.configs) {
    if (!options.has(config)) continue;

    const compilerOptions = jsonOf(config, options.read)?.['compilerOptions'] as
      { paths?: Paths; baseUrl?: string } | undefined;
    const base = posix.join(posix.dirname(config), compilerOptions?.baseUrl ?? '.');

    for (const [pattern, targets] of Object.entries(compilerOptions?.paths ?? {}))
      paths.push({ pattern, targets: targets.map((target) => posix.join(base, target)) });
  }

  return paths;
};

const mappedOf = (paths: { pattern: string; targets: string[] }[], specifier: string) =>
  paths.flatMap(({ pattern, targets }) => {
    const star = pattern.indexOf('*');

    if (star === -1) return pattern === specifier ? targets : [];
    if (!specifier.startsWith(pattern.slice(0, star)) || !specifier.endsWith(pattern.slice(star + 1))) return [];

    const matched = specifier.slice(star, specifier.length - (pattern.length - star - 1));

    return targets.map((target) => target.replace('*', matched));
  });

/**
 * The files of the checkout a build of the app at `app` can read, from `files` (repo path to content sha): every
 * root-level file except Markdown, the whole app folder, and every file its build sources reach through a relative
 * path or a tsconfig `paths` alias, followed transitively. Specs, stories and test setups are inputs but not followed.
 */
export const harnessInputsOf = (options: {
  files: ReadonlyMap<string, string>;
  app: string;
  read: (path: string) => string;
}): Map<string, string> => {
  const { files, read } = options;
  const app = posix.normalize(options.app).replace(/\/$/u, '');
  const has = (path: string) => files.has(path);
  const paths = pathsOf({
    configs: ['tsconfig.base.json', 'tsconfig.json', `${app}/tsconfig.json`, `${app}/tsconfig.app.json`],
    read,
    has,
  });
  const all = [...files.keys()];
  const dirs = new Set<string>();
  const single = new Set<string>();
  const queue: string[] = [];
  const inDir = (path: string) => {
    for (let dir = posix.dirname(path); dir !== '.'; dir = posix.dirname(dir)) if (dirs.has(dir)) return true;

    return false;
  };
  const addFile = (path: string) => {
    if (single.has(path) || inDir(path)) return;

    single.add(path);
    queue.push(path);
  };
  const addDir = (dir: string) => {
    if (dirs.has(dir) || inDir(`${dir}/.`)) return;

    dirs.add(dir);
    for (const path of all) if (path.startsWith(`${dir}/`)) queue.push(path);
  };
  const folders = new Set<string>();

  for (const path of all) for (let dir = posix.dirname(path); dir !== '.'; dir = posix.dirname(dir)) folders.add(dir);

  const reach = (target: string) => {
    const path = target.replace(/\/+$/u, '');

    if (path.startsWith('..') || path === '.' || path === '') return;

    const file = SUFFIXES.map((suffix) => `${path}${suffix}`).find(has);

    if (file) addFile(file);
    else if (folders.has(path)) addDir(path);
  };

  for (const path of all) if (!path.includes('/') && !path.endsWith('.md')) single.add(path);

  addDir(app);

  const project = jsonOf(`${app}/project.json`, read) as
    { targets?: { build?: { inputs?: unknown[]; options?: Record<string, unknown> } } } | undefined;

  for (const input of project?.targets?.build?.inputs ?? [])
    if (typeof input === 'string' && input.startsWith('{workspaceRoot}/') && !/[*{]/u.test(input.slice(16)))
      reach(posix.normalize(input.slice(16)));

  for (const value of Object.values(project?.targets?.build?.options ?? {}))
    for (const entry of [value].flat())
      if (typeof entry === 'string' && entry.length > 0) reach(posix.normalize(entry));

  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    const sha = files.get(path);

    if (sha === undefined || !SCANNED.test(path) || UNBUILT.test(path)) continue;

    for (const specifier of specifiersOf({ path, sha, read: () => read(path) })) {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        reach(posix.join(posix.dirname(path), specifier.replace(/[?#].*$/u, '')));
        continue;
      }

      for (const mapped of mappedOf(paths, specifier)) reach(posix.normalize(mapped));
    }
  }

  return new Map([...files].filter(([path]) => single.has(path) || inDir(path)));
};

/**
 * Whether an incremental Angular watch build of `app` misses a change of the input `path`: configs, root-level files
 * and files under dot folders, which its watcher ignores.
 */
export const restartsWatchBuild = (path: string) =>
  !path.includes('/') || CONFIGS.test(path) || path.split('/').some((segment) => segment.startsWith('.'));

/** Reads a repo path of the checkout at `root`. */
export const repoReaderOf = (root: string) => (path: string) => {
  try {
    return readFileSync(posix.join(root, path), 'utf8');
  } catch {
    return '';
  }
};
