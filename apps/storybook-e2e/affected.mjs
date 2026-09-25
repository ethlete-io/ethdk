import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALL = 'ALL';

const COMPONENTS_LIB = 'libs/components/src/lib';
const E2E_SRC = 'apps/storybook-e2e/src';
const STORYBOOK_PREVIEW = 'apps/storybook/.storybook/preview.ts';
const NESTED_DOMAIN_ROOTS = new Set(['forms', 'overlay']);

const IGNORED = [
  /\.mdx?$/,
  /\.spec\.[cm]?[jt]s$/,
  /(^|\/)eslint\.config\.mjs$/,
  /\.rs$/,
  /(^|\/)Cargo\.(toml|lock)$/,
  /^\.(changeset|agents|claude|codex|ethlete|husky|vscode)\//,
  /^(plans|docs)\//,
  /^apps\/(docs|docs-mcp|playground|ethlete-studio|csp[^/]*|timetrack[^/]*)\//,
  /^apps\/storybook\/src\/stories\//,
  /^libs\/(eslint-plugin|agent-rules|timetrack|cli|contentful|query-devtools)\//,
  /^libs\/cdk\/(?!.*\.css$)/,
  /^libs\/(core|query)\/src\/scenarios\//,
  /^tools\/(changesets-action|ai-migrations|api-models|treeshake|sketch)\//,
  /^(LICENSE|renovate\.json|commitlint\.config\.js|firebase\.json|\.firebaserc|ethlete-agents\.config\.json|\.editorconfig|\.prettierignore|\.prettierrc\.js)$/,
];

const RELATIVE_SPECIFIER = /['"`](\.{1,2}\/[^'"`\s]+)['"`]/g;
const STORY_ID = /['"`]([a-z0-9-]+)--[a-z0-9-]+['"`]/g;
const STORY_TITLE = /\btitle:\s*['"`]([^'"`]+)['"`]/;

export const titleToId = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const nodeOf = (file) => {
  const segments = file.slice(COMPONENTS_LIB.length + 1).split('/');
  const fileLevel =
    segments.length === 1 ||
    segments.includes('stories') ||
    segments.at(-1) === 'index.ts' ||
    file.endsWith('.stories.ts');

  if (fileLevel) return file;
  if (NESTED_DOMAIN_ROOTS.has(segments[0]) && segments.length >= 3) return `${segments[0]}/${segments[1]}`;
  return segments[0];
};

const resolveSpecifier = (from, specifier, files) => {
  const base = posix.join(posix.dirname(from), specifier);
  return [base, `${base}.ts`, `${base}/index.ts`].find((candidate) => files.has(candidate));
};

export const buildIndex = ({ componentFiles, e2eFolders, previewSource = '' }) => {
  const importers = new Map();
  const dependencies = new Map();
  const storyFilesById = new Map();
  const link = (map, key, value) => map.set(key, (map.get(key) ?? new Set()).add(value));

  for (const [file, content] of componentFiles) {
    const from = nodeOf(file);

    for (const [, specifier] of content.matchAll(RELATIVE_SPECIFIER)) {
      const target = resolveSpecifier(file, specifier, componentFiles);
      if (!target || nodeOf(target) === from) continue;
      link(importers, nodeOf(target), from);
      link(dependencies, from, nodeOf(target));
    }

    const title = file.endsWith('.stories.ts') ? content.match(STORY_TITLE)?.[1] : undefined;
    if (title) link(storyFilesById, titleToId(title), file);
  }

  const folders = new Map();

  for (const [folder, content] of e2eFolders) {
    const ids = new Set([...content.matchAll(STORY_ID)].map(([, id]) => id));
    const storyFiles = new Set();
    let resolved = ids.size > 0;

    for (const id of ids) {
      const files = storyFilesById.get(id);
      if (files) files.forEach((file) => storyFiles.add(file));
      else if (id.startsWith('components-')) resolved = false;
    }

    folders.set(folder, { storyFiles, resolved });
  }

  const previewNames = [...previewSource.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"]/g)]
    .flatMap(([, names]) => names.split(','))
    .map((name) => name.trim().split(/\s+as\s+/)[0])
    .filter(Boolean);
  const previewRoots = [...componentFiles]
    .filter(([, content]) =>
      previewNames.some((name) => new RegExp(`export\\s+(const|function|class)\\s+${name}\\b`).test(content)),
    )
    .map(([file]) => nodeOf(file));

  return { importers, folders, globalNodes: closure(previewRoots, dependencies) };
};

const closure = (start, edges) => {
  const seen = new Set(start);
  const queue = [...start];

  while (queue.length) {
    for (const next of edges.get(queue.pop()) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return seen;
};

export const selectE2eFolders = (changedFiles, index) => {
  const selected = new Set();
  const changedNodes = [];

  for (const file of changedFiles) {
    if (IGNORED.some((pattern) => pattern.test(file))) continue;

    if (file.startsWith(`${E2E_SRC}/`)) {
      const [folder, ...rest] = file.slice(E2E_SRC.length + 1).split('/');
      if (!rest.length || !index.folders.has(folder)) return ALL;
      selected.add(folder);
      continue;
    }

    if (!file.startsWith(`${COMPONENTS_LIB}/`)) return ALL;
    const node = nodeOf(file);
    if (index.globalNodes.has(node)) return ALL;
    changedNodes.push(node);
  }

  const affected = closure(changedNodes, index.importers);

  for (const [folder, { storyFiles }] of index.folders) {
    if ([...storyFiles].some((file) => affected.has(file))) selected.add(folder);
  }

  if (selected.size) {
    for (const [folder, { resolved }] of index.folders) if (!resolved) selected.add(folder);
  }

  return [...selected].sort();
};

const listFiles = (root, dir) =>
  readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split('\\').join('/'));

export const readIndex = (root) => {
  const componentFiles = new Map(
    listFiles(root, COMPONENTS_LIB)
      .filter((file) => /\.(ts|css|html)$/.test(file) && !file.endsWith('.spec.ts'))
      .map((file) => [file, readFileSync(join(root, file), 'utf8')]),
  );
  const e2eFolders = new Map(
    readdirSync(join(root, E2E_SRC), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [entry.name, listFiles(root, `${E2E_SRC}/${entry.name}`)])
      .filter(([, files]) => files.some((file) => file.endsWith('.e2e.ts')))
      .map(([folder, files]) => [folder, files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n')]),
  );
  const previewPath = join(root, STORYBOOK_PREVIEW);
  const previewSource = existsSync(previewPath) ? readFileSync(previewPath, 'utf8') : '';

  return buildIndex({ componentFiles, e2eFolders, previewSource });
};

const changedFilesSince = (root, base) => {
  try {
    return execFileSync('git', ['diff', '--name-only', base.includes('..') ? base : `${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return undefined;
  }
};

const main = () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const args = process.argv.slice(2);
  const run = args.includes('--run');
  const [base, ...playwrightArgs] = args.filter((arg) => arg !== '--run');
  const changedFiles = base && !/^0+$/.test(base) ? changedFilesSince(root, base) : undefined;
  const selection = changedFiles ? selectE2eFolders(changedFiles, readIndex(root)) : ALL;

  if (!run) {
    console.log(selection === ALL ? ALL : selection.join('\n'));
    return;
  }

  if (!selection.length) {
    console.log('No component behavior test is affected.');
    return;
  }

  const folders = selection === ALL ? [] : selection.map((folder) => `${E2E_SRC}/${folder}/`);
  console.log(`Running ${selection === ALL ? 'every suite' : selection.join(', ')}`);
  const result = spawnSync(
    'yarn',
    ['playwright', 'test', '-c', 'apps/storybook-e2e/playwright.config.ts', ...playwrightArgs, ...folders],
    { cwd: root, stdio: 'inherit' },
  );
  process.exitCode = result.status ?? 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
