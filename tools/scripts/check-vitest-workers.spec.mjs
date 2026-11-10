import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { testTargetProblemsOf, vitestConfigs, workerProblemsOf } from './check-vitest-workers.mjs';

test('every vitest config that runs tests uses the shared worker preset', () => {
  const configs = vitestConfigs();

  assert.ok(configs.length > 10);

  const problems = configs.flatMap((path) => workerProblemsOf(path, readFileSync(path, 'utf8')));

  assert.deepEqual(problems, []);
});

test('a config without the preset is reported by file and cause', () => {
  const [problem] = workerProblemsOf('libs/x/vitest.config.mts', 'export default { test: { name: "x" } };');

  assert.match(problem, /libs\/x\/vitest\.config\.mts/);
  assert.match(problem, /core count/);
});

test('browser, no-test and serial configs are exempt', () => {
  assert.deepEqual(workerProblemsOf('a', 'export default { plugins: [] };'), []);
  assert.deepEqual(workerProblemsOf('a', 'export default { test: { browser: { enabled: true } } };'), []);
  assert.deepEqual(workerProblemsOf('a', 'export default { test: { fileParallelism: false } };'), []);
});

test('every vitest config that runs tests belongs to a project with a test target', () => {
  const problems = vitestConfigs().flatMap((path) => testTargetProblemsOf(path, readFileSync(path, 'utf8')));

  assert.deepEqual(problems, []);
});

test('a config whose project has no test target is reported, an explicit or inferred one passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'vitest-targets-'));
  const nxJson = {
    plugins: [{ plugin: '@nx/vitest', options: { testTargetName: 'test' }, include: ['libs/inferred/**/*'] }],
  };
  writeFileSync(join(root, 'nx.json'), JSON.stringify(nxJson));

  for (const [dir, targets] of [
    ['apps/bare', { build: {} }],
    ['apps/explicit', { test: {} }],
    ['libs/inferred', {}],
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 'project.json'), JSON.stringify({ targets }));
  }

  const source = 'export default { test: { name: "x" } };';
  const [problem] = testTargetProblemsOf('apps/bare/vitest.config.mts', source, root);

  assert.match(problem, /apps\/bare\/vitest\.config\.mts has no `test` target in apps\/bare\/project\.json/);
  assert.deepEqual(testTargetProblemsOf('apps/explicit/vitest.config.mts', source, root), []);
  assert.deepEqual(testTargetProblemsOf('libs/inferred/vite.config.mts', source, root), []);
  assert.deepEqual(
    testTargetProblemsOf(
      'apps/bare/vitest.config.mts',
      'export default { test: { browser: { enabled: true } } };',
      root,
    ),
    [],
  );
});
