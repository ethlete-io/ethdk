import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { specsForScripts, toolFiles } from './staged-script-specs.mjs';

const root = join(import.meta.dirname, '..', '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('a script that a spec copies as a fixture selects that spec', () => {
  const specs = specsForScripts(['tools/scripts/lint-changesets.js'], toolFiles(), read);

  assert.ok(specs.includes('tools/scripts/push-suite.spec.mjs'));
  assert.ok(specs.includes('tools/scripts/lint-changesets.spec.mjs'));
});

test('a hook script copied by a tools spec selects that spec', () => {
  const specs = specsForScripts(['.husky/format-check-committed.mjs'], toolFiles(), read);

  assert.ok(specs.includes('tools/scripts/push-suite.spec.mjs'));
});

test('a script reached only through another script selects the spec of that script', () => {
  const sources = {
    'a.mjs': "import './b.mjs';",
    'b.mjs': '',
    'a.spec.mjs': "import './a.mjs';",
    'c.spec.mjs': "import './c.mjs';",
  };

  assert.deepEqual(
    specsForScripts(['b.mjs'], Object.keys(sources), (s) => sources[s]),
    ['a.spec.mjs'],
  );
});

test('a staged spec runs itself, and a name only as a prefix of another selects nothing', () => {
  const sources = { 'a.spec.mjs': "import './x-extra.mjs';", 'b.spec.mjs': "join(here, 'y.mjs')" };

  assert.deepEqual(
    specsForScripts(['tools/scripts/x.mjs', 'b.spec.mjs'], Object.keys(sources), (s) => sources[s]),
    ['b.spec.mjs'],
  );
});
