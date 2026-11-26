import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as helper from './git-test-env.mjs';

const root = join(import.meta.dirname, '..', '..');
const copies = ['libs/cli/src/lib', 'libs/agent-rules/src/lib'];
const read = (dir, file) => readFileSync(join(root, dir, file), 'utf8');
const exportedNames = (source) => [...source.matchAll(/^export const (\w+)/gm)].map(([, name]) => name).sort();

test('the lib copies of the git test helper are identical', () => {
  const [first, ...rest] = copies.map((dir) => read(dir, 'git-test-env.fixtures.ts'));
  for (const copy of rest) assert.equal(copy, first);
});

test('the lib copies export the same names as the tools helper', () => {
  for (const dir of copies)
    assert.deepEqual(exportedNames(read(dir, 'git-test-env.fixtures.ts')), Object.keys(helper).sort());
});

test('each lib copy has a spec that proves the hook repo stays untouched', () => {
  const specs = copies.map((dir) => read(dir, 'git-test-env.spec.ts'));
  for (const spec of specs) assert.match(spec, /leaves the repo a hook points at untouched/);
});
