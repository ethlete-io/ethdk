import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { lostFindings } from './check-plan-findings.mjs';
import { git, gitExec, tempGitRepo } from './git-test-env.mjs';

const PLAN = 'plans/ethlete-studio/design-to-code.md';
const SCRIPT = join(import.meta.dirname, 'check-plan-findings.mjs');

const base = '# Plan\n\n101\\. one head\nbody\n\n101 as built (2026-11-01): built\n\n102\\. two head\n';

test('an unchanged plan loses nothing', () => {
  assert.deepEqual(lostFindings(base, base), []);
});

test('a removed head and as-built line are named', () => {
  const lost = lostFindings(base, '# Plan\n\n102\\. two head\n');
  assert.deepEqual(
    lost.map((l) => `${l.number} ${l.kind}`),
    ['101 head', '101 as built'],
  );
});

test('an edited head line is not a removal', () => {
  assert.deepEqual(lostFindings(base, base.replace('one head', 'one head, edited')), []);
});

test('lines added to an archive file count as archived', () => {
  assert.deepEqual(
    lostFindings(base, '# Plan\n', '101\\. one head\n101 as built (2026-11-01): built\n102\\. two head'),
    [],
  );
});

test('the real 0c2451802 cut is refused in a temp repo and names the lost findings', () => {
  const root = join(import.meta.dirname, '../..');
  let before;
  let after;
  try {
    before = gitExec(['show', `0c2451802^:${PLAN}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
    after = gitExec(['show', `0c2451802:${PLAN}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch {
    return;
  }
  const expected = lostFindings(before, after).map((l) => l.number);
  assert.ok(expected.length > 0);
  const repo = tempGitRepo('plan-findings-');
  git(repo, 'config', 'user.email', 'a@b.c');
  git(repo, 'config', 'user.name', 'a');
  mkdirSync(join(repo, 'plans/ethlete-studio'), { recursive: true });
  writeFileSync(join(repo, PLAN), before);
  git(repo, 'add', '--', PLAN);
  git(repo, 'commit', '-q', '-m', 'base');
  writeFileSync(join(repo, PLAN), after);
  git(repo, 'add', '--', PLAN);
  let status = 0;
  let stderr = '';
  try {
    execFileSync('node', [SCRIPT], { cwd: repo, stdio: 'pipe', encoding: 'utf8' });
  } catch (error) {
    status = error.status;
    stderr = String(error.stderr);
  }
  assert.equal(status, 1);
  for (const number of expected) assert.ok(stderr.includes(number), `names ${number}`);
  assert.match(stderr, /append it with `node tools\/scripts\/archive-findings.mjs`, or restore the lines/);
});
