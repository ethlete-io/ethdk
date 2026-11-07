import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readsSourcePath, specsForFiles, unmappedSpecs } from './cli-related-map.mjs';

const loader = "import { readFileSync } from 'fs';\nreadFileSync(join(__dirname, 'frame.ts'), 'utf8');";

test('flags a spec that reads a source by path', () => {
  assert.equal(readsSourcePath(loader), true);
  assert.equal(readsSourcePath("readFileSync(join(tmp, 'a.ts'))"), false);
  assert.equal(readsSourcePath("join(__dirname, 'frame.ts')"), false);
});

test('reports unmapped specs only', () => {
  const specs = [
    { path: 'a.spec.ts', text: loader },
    { path: 'b.spec.ts', text: loader },
  ];
  assert.deepEqual(
    unmappedSpecs(specs, { 'b.spec.ts': ['x.ts'] }).map((s) => s.path),
    ['a.spec.ts'],
  );
});

test('maps a staged file to its specs through globs', () => {
  const map = { 'a.spec.ts': ['libs/x/rules/*.ts'], 'b.spec.ts': ['libs/y/f.ts'] };
  assert.deepEqual(specsForFiles(['libs/x/rules/r.ts'], map), ['a.spec.ts']);
  assert.deepEqual(specsForFiles(['libs/x/rules/deep/r.ts'], map), []);
  assert.deepEqual(specsForFiles(['libs/y/f.ts'], map), ['b.spec.ts']);
});

test('flags a spec that reads a data file of the repo by path', () => {
  const dataLoader = "readFileSync(join(__dirname, '../../../migrations.json'), 'utf8');";
  assert.equal(readsSourcePath(dataLoader), true);
  assert.equal(readsSourcePath("writeJson(join(core, 'migrations.json'), {})"), false);
});

test('maps a data file to the specs that read it', () => {
  const map = { 'g.spec.ts': ['libs/*/migrations.json', 'libs/*/generators/generators.json'] };
  assert.deepEqual(specsForFiles(['libs/core/migrations.json'], map), ['g.spec.ts']);
  assert.deepEqual(specsForFiles(['libs/core/generators/generators.json'], map), ['g.spec.ts']);
});
