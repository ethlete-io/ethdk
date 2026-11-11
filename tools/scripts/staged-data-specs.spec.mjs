import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specsForData } from './staged-data-specs.mjs';

const map = {
  'a.spec.ts': ['.ethlete/design/**/*.json'],
  'b.spec.ts': ['.ethlete/design/config.json', '.github/workflows/*.yml'],
};

test('a nested json under the glob selects its spec', () => {
  assert.deepEqual(specsForData(['.ethlete/design/studio-lab/ready.json'], map), ['a.spec.ts']);
});

test('a json directly under the folder matches the double-star glob', () => {
  assert.deepEqual(specsForData(['.ethlete/design/config.json'], map), ['a.spec.ts', 'b.spec.ts']);
});

test('a path outside every glob selects nothing', () => {
  assert.deepEqual(
    specsForData(['.ethlete/design/studio/colors.css', 'libs/cli/x.ts', '.github/workflows/a/b.yml'], map),
    [],
  );
});

test('a single star does not cross a folder', () => {
  assert.deepEqual(specsForData(['.github/workflows/ci.yml'], map), ['b.spec.ts']);
});

test('a double-star glob crosses several folders', () => {
  assert.deepEqual(specsForData(['.ethlete/design/sdk/comments/deep/x.json'], map), ['a.spec.ts']);
});
