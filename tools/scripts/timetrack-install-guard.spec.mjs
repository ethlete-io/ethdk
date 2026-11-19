import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { guardInstall } from './timetrack-install-guard.mjs';

const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const checkout = ({ lockAge, stateAge }) => {
  const root = mkdtempSync(join(tmpdir(), 'tt-guard-'));
  created.push(root);
  mkdirSync(join(root, 'node_modules'));
  const now = Date.now() / 1000;
  writeFileSync(join(root, 'yarn.lock'), '');
  utimesSync(join(root, 'yarn.lock'), now - lockAge, now - lockAge);

  if (stateAge !== null) {
    const state = join(root, 'node_modules', '.yarn-state.yml');
    writeFileSync(state, '');
    utimesSync(state, now - stateAge, now - stateAge);
  }

  return root;
};

const run = (root, status = 0) => {
  const calls = [];
  const logs = [];
  const code = guardInstall({
    root,
    install: () => (calls.push(root), status),
    log: (line) => logs.push(line),
  });

  return { calls, logs, code };
};

test('installs when yarn.lock is newer than the state file', () => {
  const { calls, code } = run(checkout({ lockAge: 10, stateAge: 100 }));
  assert.equal(calls.length, 1);
  assert.equal(code, 0);
});

test('does not install when the state file is newer', () => {
  const { calls, code } = run(checkout({ lockAge: 100, stateAge: 10 }));
  assert.equal(calls.length, 0);
  assert.equal(code, 0);
});

test('installs when the state file is missing', () => {
  const { calls } = run(checkout({ lockAge: 10, stateAge: null }));
  assert.equal(calls.length, 1);
});

test('a failed install exits non-zero with a reason naming yarn.lock', () => {
  const { code, logs } = run(checkout({ lockAge: 10, stateAge: 100 }), 1);
  assert.equal(code, 1);
  assert.match(logs.at(-1), /yarn\.lock/);
});
