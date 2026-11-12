import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import { checkMigrationEntries, generatorsWithoutEntry } from './check-migration-entries.mjs';

const generators = { generators: { a: {}, b: {}, c: { scaffold: true } } };

test('a generator named by generator or scan has an entry', () => {
  const migrations = { migrations: [{ generator: '@ethlete/x:a' }, { scan: '@ethlete/x:b' }] };
  assert.deepEqual(generatorsWithoutEntry(generators, migrations), []);
});

test('a generator without an entry and without the scaffold mark is reported', () => {
  assert.deepEqual(generatorsWithoutEntry(generators, { migrations: [{ generator: '@ethlete/x:a' }] }), ['b']);
  assert.deepEqual(generatorsWithoutEntry(generators, null), ['a', 'b']);
});

test('the message names both ways out', () => {
  const root = tempDir('migration-entries-');
  mkdirSync(join(root, 'libs', 'core', 'generators'), { recursive: true });
  writeFileSync(join(root, 'libs', 'core', 'generators', 'generators.json'), JSON.stringify({ generators: { a: {} } }));

  const [error] = checkMigrationEntries(root);

  assert.match(error, /"a" is not in migrations\.json/);
  assert.match(error, /Add an entry/);
  assert.match(error, /"scaffold": true/);
});
