import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { handoffCuts, isHandoffPath } from './check-handoff-shrink.mjs';
import { tempDir } from './temp-dir.mjs';

const lines = (n) => Array.from({ length: n }, (_, i) => `note ${i}`).join('\n') + '\n';
const script = new URL('./check-handoff-shrink.mjs', import.meta.url).pathname;

test('only handoff-*.md files under plans/ count as handoffs', () => {
  assert.equal(isHandoffPath('plans/ethlete-studio/handoff-doc-agent.md'), true);
  assert.equal(isHandoffPath('plans/handoff-x.md'), true);
  assert.equal(isHandoffPath('plans/ethlete-studio/design-to-code.md'), false);
  assert.equal(isHandoffPath('docs/handoff-x.md'), false);
});

test('a handoff cut to fewer than half of its lines is refused', () => {
  const cuts = handoffCuts('docs(repo): Record 967', [
    { path: 'plans/ethlete-studio/handoff-doc-agent.md', before: lines(40), after: lines(1) },
  ]);
  assert.equal(cuts.length, 1);
  assert.match(cuts[0], /handoff-doc-agent\.md: 40 -> 1 lines/);
});

test('a deleted handoff is refused', () => {
  assert.equal(handoffCuts('docs(repo): x', [{ path: 'plans/handoff-a.md', before: lines(4), after: '' }]).length, 1);
});

test('a cut of half the lines or less, a growth and a non-handoff file pass', () => {
  assert.deepEqual(
    handoffCuts('docs(repo): x', [
      { path: 'plans/handoff-a.md', before: lines(40), after: lines(20) },
      { path: 'plans/handoff-b.md', before: lines(3), after: lines(9) },
      { path: 'plans/ethlete-studio/design-to-code.md', before: lines(40), after: lines(1) },
    ]),
    [],
  );
});

test('"shrink handoff" in the message lets the cut through', () => {
  assert.deepEqual(
    handoffCuts('docs(repo): Shrink handoff to the open items', [
      { path: 'plans/handoff-a.md', before: lines(40), after: lines(1) },
    ]),
    [],
  );
});

test('the commit-msg hook runs the check with the message file', () => {
  const hook = readFileSync(new URL('../../.husky/commit-msg', import.meta.url), 'utf8');
  assert.match(hook, /node \.\/tools\/scripts\/check-handoff-shrink\.mjs "?\$1"?/);
});

test('the script reads the staged blob of a real repo', () => {
  const repo = tempDir('handoff-shrink-');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'a@example.com');
  git('config', 'user.name', 'a');
  mkdirSync(join(repo, 'plans'));
  writeFileSync(join(repo, 'plans/handoff-a.md'), lines(10));
  git('add', '.');
  git('commit', '-qm', 'init');
  writeFileSync(join(repo, 'plans/handoff-a.md'), lines(1));
  git('add', '.');
  writeFileSync(join(repo, 'msg'), 'docs(repo): x\n');
  const refused = spawnSync('node', [script, 'msg'], { cwd: repo, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /plans\/handoff-a\.md: 10 -> 1 lines/);
  writeFileSync(join(repo, 'msg'), 'docs(repo): Shrink handoff\n');
  assert.equal(spawnSync('node', [script, 'msg'], { cwd: repo }).status, 0);
});
