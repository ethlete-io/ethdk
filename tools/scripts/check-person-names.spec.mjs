import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { personNameFindings, personNameProblems } from './check-person-names.mjs';

test('flags a known first name as a word and inside a camel-case identifier', () => {
  assert.equal(personNameFindings('ready --by tom').length, 1);
  assert.equal(personNameFindings('class TomPrompt {}').length, 1);
});

test('flags the git user name', () => {
  assert.equal(personNameFindings('by Ada Lovelace today', 'Ada Lovelace').length, 1);
});

test('ignores words that only contain a name', () => {
  assert.deepEqual(personNameFindings('tomorrow the atomic tomato'), []);
});

test('fails only when a file exceeds its baseline', () => {
  const hits = [{ line: 1, text: 'x' }];
  assert.equal(personNameProblems({ 'a.ts': hits }, { 'a.ts': 1 }).length, 0);
  assert.equal(personNameProblems({ 'a.ts': hits }, {}).length, 1);
});

test('an app sample file with a person name fails even when the baseline lists it', () => {
  const hits = [{ line: 1, text: 'x' }];
  const file = 'apps/ethlete-studio/src/app/sample.ts';
  assert.equal(personNameProblems({ [file]: hits }, { [file]: 1 }).length, 1);
  assert.equal(personNameProblems({ 'libs/a.ts': hits }, { 'libs/a.ts': 1 }).length, 0);
});

test('reports the right line when a name sits deep in a multi-line text', () => {
  const text = ['one', 'two Words', 'three', 'ask Tom here', 'five'].join('\n');
  assert.deepEqual(personNameFindings(text), [{ line: 4, text: 'ask Tom here' }]);
  assert.deepEqual(personNameFindings('plain\ntext\ntomorrow'), []);
});

test('--staged blocks a commit whose staged blob names a person and ignores the working tree', () => {
  const repo = mkdtempSync(join(tmpdir(), 'person-names-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  mkdirSync(join(repo, 'libs'));
  writeFileSync(join(repo, 'libs/a.ts'), "export const author = 'Tom Bornholdt';\n");
  git('add', 'libs/a.ts');
  writeFileSync(join(repo, 'libs/a.ts'), 'export const author = "human";\n');
  const run = (...flags) =>
    spawnSync(process.execPath, [join(import.meta.dirname, 'check-person-names.mjs'), ...flags], {
      cwd: repo,
      encoding: 'utf8',
    });
  const staged = run('--staged');
  assert.equal(staged.status, 1);
  assert.match(staged.stderr, /libs\/a\.ts: 1 person-name lines, 0 allowed/);
  rmSync(repo, { recursive: true, force: true });
});
