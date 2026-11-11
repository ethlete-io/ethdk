import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { run as archive } from './archive-findings.mjs';
import { findingOrderErrors, lostFindings } from './check-plan-findings.mjs';
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

const runCheck = (repo) => {
  try {
    execFileSync('node', [SCRIPT], { cwd: repo, stdio: 'pipe', encoding: 'utf8' });
    return { status: 0, stderr: '' };
  } catch (error) {
    return { status: error.status, stderr: String(error.stderr) };
  }
};

const archivedRepo = () => {
  const repo = tempGitRepo('plan-findings-archive-');
  git(repo, 'config', 'user.email', 'a@b.c');
  git(repo, 'config', 'user.name', 'a');
  const studio = join(repo, 'plans/ethlete-studio');
  mkdirSync(studio, { recursive: true });
  const findings = [101, 102, 103].map(
    (n) => `${n}\\. Tom (2026-10-01): head ${n}\nbody ${n}\n${n} as built (2026-10-02): built ${n}`,
  );
  writeFileSync(join(studio, 'design-to-code.md'), `# Plan\n\n${findings.join('\n\n')}\n`);
  writeFileSync(
    join(studio, 'STATUS.md'),
    '| ID | Was | Stand | Wo |\n| -- | -- | -- | -- |\n| B1 | one (Bef. 101) | ✅ | |\n| B2 | two (Bef. 102) | ✅ | |\n| B3 | three (Bef. 103) | ✅ | |\n',
  );
  git(repo, 'add', '--', 'plans');
  git(repo, 'commit', '-q', '-m', 'base');
  assert.equal(archive(repo), 3);
  return { repo, archiveFile: join(studio, 'archive/findings-2026-10.md') };
};

test('archive-findings output passes the check when staged with the plan', () => {
  const { repo } = archivedRepo();
  git(repo, 'add', '--', 'plans');
  assert.deepEqual(runCheck(repo), { status: 0, stderr: '' });
});

test('an archive line edited after archive-findings is refused and named', () => {
  const { repo, archiveFile } = archivedRepo();
  writeFileSync(
    archiveFile,
    readFileSync(archiveFile, 'utf8').replace(
      '102 as built (2026-10-02): built 102',
      '102 as built (2026-10-02): changed',
    ),
  );
  git(repo, 'add', '--', 'plans');
  const result = runCheck(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /102 \(as built\)/);
  assert.doesNotMatch(result.stderr, /101|103/);
});

test('a finding out of number order is named', () => {
  assert.deepEqual(findingOrderErrors(base), []);
  assert.deepEqual(findingOrderErrors('103\\. c\n\n101\\. a\n\n104\\. d\n'), [
    'finding 101 follows finding 103; numbers must increase',
  ]);
});

test('the real 34b823e8f order is refused by the pre-commit hook in a temp repo', () => {
  const root = join(import.meta.dirname, '../..');
  let before;
  let after;
  try {
    before = gitExec(['show', `34b823e8f^:${PLAN}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
    after = gitExec(['show', `34b823e8f:${PLAN}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch {
    return;
  }
  const repo = tempGitRepo('plan-findings-order-');
  git(repo, 'config', 'user.email', 'a@b.c');
  git(repo, 'config', 'user.name', 'a');
  mkdirSync(join(repo, 'plans/ethlete-studio'), { recursive: true });
  writeFileSync(join(repo, PLAN), before);
  git(repo, 'add', '--', PLAN);
  git(repo, 'commit', '-q', '-m', 'base');
  writeFileSync(join(repo, PLAN), after);
  git(repo, 'add', '--', PLAN);
  const result = runCheck(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /finding 797 follows finding 807; numbers must increase/);
});
