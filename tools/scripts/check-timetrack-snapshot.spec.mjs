import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasFreshSnapshot, isRowChangingPath, snapshotCheck } from './check-timetrack-snapshot.mjs';

const ROW = 'libs/timetrack/src/lib/rows/round.ts';

test('row-changing paths', () => {
  assert.equal(isRowChangingPath(ROW), true);
  assert.equal(isRowChangingPath('apps/timetrack/src/app/read-day.ts'), true);
  assert.equal(isRowChangingPath('apps/timetrack/src/app/day-review/x.ts'), true);
  assert.equal(isRowChangingPath('libs/timetrack/src/lib/jira/x.ts'), false);
  assert.equal(isRowChangingPath('libs/timetrack/src/lib/rows/round.spec.ts'), false);
  assert.equal(isRowChangingPath('libs/components/src/a.ts'), false);
});

test('no row path passes without a line', () => {
  assert.equal(snapshotCheck('fix: x', ['libs/cli/a.ts'], () => false).ok, true);
});

test('a row path needs a Snapshot line', () => {
  assert.equal(snapshotCheck('fix: x', [ROW], () => true).ok, false);
});

test('not run needs a reason', () => {
  assert.equal(snapshotCheck('fix: x\n\nSnapshot: not run (app not running)', [ROW], () => false).ok, true);
  assert.equal(snapshotCheck('fix: x\n\nSnapshot: not run ()', [ROW], () => true).ok, false);
});

test('a plain line needs a fresh snapshot', () => {
  const message = 'fix: x\n\nSnapshot: compare shows 0 changed rows';
  assert.equal(snapshotCheck(message, [ROW], () => true).ok, true);
  assert.equal(snapshotCheck(message, [ROW], () => false).ok, false);
});

test('a spec file under rows passes without a line', () => {
  assert.equal(snapshotCheck('fix: x', ['libs/timetrack/src/lib/rows/round.spec.ts'], () => false).ok, true);
});

test('freshness follows the mtime of a json file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  assert.equal(hasFreshSnapshot(dir), false);
  const file = join(dir, 'a.json');
  writeFileSync(file, '{}');
  assert.equal(hasFreshSnapshot(dir), true);
  const old = new Date(Date.now() - 7 * 60 * 60 * 1000);
  utimesSync(file, old, old);
  assert.equal(hasFreshSnapshot(dir), false);
});

test('end to end in a temp repo', () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo });
  git('init', '-q');
  mkdirSync(join(repo, 'libs/timetrack/src/lib/rows'), { recursive: true });
  writeFileSync(join(repo, ROW), 'export {};\n');
  git('add', ROW);
  const messageFile = join(repo, 'msg');
  const script = fileURLToPath(new URL('./check-timetrack-snapshot.mjs', import.meta.url));
  const run = (message) => {
    writeFileSync(messageFile, message);
    return spawnSync('node', [script, messageFile], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, TIMETRACK_SNAPSHOT_DIR: join(repo, 'none') },
    });
  };
  const failed = run('fix: x\n');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /libs\/timetrack\/src\/lib\/rows\/round\.ts/);
  assert.equal(run('fix: x\n\nSnapshot: not run (app not running)\n').status, 0);
});
