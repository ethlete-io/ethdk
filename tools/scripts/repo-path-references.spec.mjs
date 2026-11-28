import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const filesUnder = (dir, suffix) =>
  readdirSync(join(repoRoot, dir), { recursive: true })
    .filter((name) => name.endsWith(suffix) && !name.includes('node_modules'))
    .map((name) => join(dir, name));

const PATH_REFERENCE = /(?<![\w/.@-])(?:libs|apps)\/[\w.*/-]*\.(?:ts|mts|mjs|rs|json|md|css)\b/g;

const globExists = (path) => {
  const dir = join(repoRoot, dirname(path));
  if (!existsSync(dir)) return false;
  const name = new RegExp(
    `^${path
      .slice(dirname(path).length + 1)
      .replace(/[.]/g, '\\.')
      .replace(/\*/g, '.*')}$`,
  );
  return readdirSync(dir).some((entry) => name.test(entry));
};

const isRepoProject = (path) => existsSync(join(repoRoot, path.split('/').slice(0, 2).join('/')));

const referenceExists = (path) => (path.includes('*') ? globExists(path) : existsSync(join(repoRoot, path)));

test('source paths named in docs, agent guides and Studio Rust sources exist', () => {
  const sources = [
    ...filesUnder('apps/ethlete-studio/src-tauri/src', '.rs'),
    ...filesUnder('apps/docs/cli', '.md'),
    'AGENTS.md',
    'libs/cli/README.md',
    ...readdirSync(join(repoRoot, 'libs'))
      .map((lib) => join('libs', lib, 'AGENTS.md'))
      .filter((path) => existsSync(join(repoRoot, path))),
  ];
  const stale = sources.flatMap((file) =>
    [...readFileSync(join(repoRoot, file), 'utf8').matchAll(PATH_REFERENCE)]
      .map(([path]) => path)
      .filter((path) => isRepoProject(path) && !referenceExists(path))
      .map((path) => `${file}: ${path}`),
  );
  assert.deepEqual([...new Set(stale)], []);
});
