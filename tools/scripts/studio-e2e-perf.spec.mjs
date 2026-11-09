import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const list = (...flags) =>
  spawnSync('node', ['apps/ethlete-studio/e2e/canvas.e2e.mjs', '--list', ...flags], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
  }).stdout;

test('a perf case never runs in the default selection', () => {
  const perf = list('--perf');
  const perfNames = perf.split('\n').flatMap((row) => row.match(/^\s*[\d.]+s\s+\S+\s+(.+)$/u)?.[1] ?? []);
  const defaults = list();

  assert.ok(perfNames.length > 0);
  for (const name of perfNames) assert.ok(!defaults.includes(name), name);
});

test('--case finds a perf case only together with --perf', () => {
  assert.match(list('--case', 'page switch time'), /^0 of 0 cases/u);
  assert.match(list('--case', 'page switch time', '--perf'), /^1 of 1 cases/u);
});

test('--delay-pictures spares the cases that wait for a new picture, never the scroll case', () => {
  const rows = list('--delay-pictures', '60000').split('\n');
  const row = (name) => rows.find((line) => line.includes(name));

  assert.ok(row('a sketch scroll never empties'));
  assert.ok(!row('a sketch scroll never empties').includes('[pictures not delayed]'));
  for (const name of [
    'a sketch cell edited on disk while scrolled away shows its new picture on return',
    'a part edited on disk while away shows its new picture on return',
    'a part shown before paints every stored picture',
  ])
    assert.ok(row(name)?.includes('[pictures not delayed]'), name);
});
