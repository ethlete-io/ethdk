import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const cyclesOf = (dependencies) => {
  const cycles = [];
  const state = new Map();
  const visit = (node, path) => {
    state.set(node, 'open');
    for (const { target } of dependencies[node] ?? []) {
      if (state.get(target) === 'open') cycles.push([...path.slice(path.indexOf(target)), target].join(' -> '));
      else if (!state.has(target)) visit(target, [...path, target]);
    }
    state.set(node, 'done');
  };
  for (const node of Object.keys(dependencies)) if (!state.has(node)) visit(node, [node]);
  return cycles;
};

test('finds a two-project cycle', () => {
  assert.deepEqual(cyclesOf({ a: [{ target: 'b' }], b: [{ target: 'a' }] }), ['a -> b -> a']);
});

test('the nx project graph has no cycle', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graph-'));
  try {
    const file = join(dir, 'graph.json');
    const result = spawnSync('npx', ['nx', 'graph', `--file=${file}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, NX_NO_CLOUD: 'true' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(cyclesOf(JSON.parse(readFileSync(file, 'utf8')).graph.dependencies), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
