import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { vitestConfigs, workerProblemsOf } from './check-vitest-workers.mjs';

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
