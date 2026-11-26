import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { git, gitSpawn, tempGitRepo } from './git-test-env.mjs';
import { cleanGitEnv, mirrorCommit, mirrorSuite, newCommits, parseArgs, verdictOf } from './next-mirror.mjs';

const commit = (repo, name) => {
  writeFileSync(join(repo, name), name);
  git(repo, 'add', name);
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', `add ${name}`);
  return git(repo, 'rev-parse', 'HEAD');
};

const gitOf = (repo) => (args) => gitSpawn(args, { cwd: repo, encoding: 'utf8' });

test('cleanGitEnv drops every GIT_ variable a hook sets', () => {
  const env = cleanGitEnv({ GIT_DIR: '/x', GIT_INDEX_FILE: 'i', GIT_WORK_TREE: '/w', PATH: '/bin' });
  assert.deepEqual(env, { PATH: '/bin' });
});

test('parseArgs reads the command, repo and revision', () => {
  const opts = parseArgs(['run', '--repo', '/tmp/r', 'HEAD']);
  assert.equal(opts.command, 'run');
  assert.equal(opts.repo, '/tmp/r');
  assert.equal(opts.rev, 'HEAD');
  assert.equal(parseArgs(['watch', '--every', '3']).every, 3);
  assert.throws(() => parseArgs(['run']));
  assert.throws(() => parseArgs(['push']));
});

test('mirrorSuite runs the push-suite steps over the commit alone', () => {
  assert.equal(mirrorSuite('b', 'a'), 'node tools/scripts/push-suite.mjs --only lint,tools,coverage a..b');
});

test('verdictOf names the failing step, and keeps infrastructure failures apart from red', () => {
  assert.deepEqual(verdictOf(0, 'x\npush-suite: ok abc123\n'), { status: 'green', step: undefined });
  assert.deepEqual(verdictOf(1, 'push-suite: blocked tools failed at abc123\n'), { status: 'red', step: 'tools' });
  assert.deepEqual(verdictOf(1, 'push-suite: blocked pre-push checks failed (format, changesets) at abc\n'), {
    status: 'red',
    step: 'checks: format, changesets',
  });
  assert.equal(verdictOf(1, '[remote-run] scp failed: no route\n').status, 'error');
  assert.equal(verdictOf(1, '[remote-run] scp failed: no route\n').step, '[remote-run] scp failed: no route');
  assert.equal(verdictOf(0, 'no suite line\n').status, 'error');
});

test('newCommits lists unmirrored commits oldest first and only the head after a rewrite', () => {
  const repo = tempGitRepo('next-mirror-');
  const a = commit(repo, 'a');
  const b = commit(repo, 'b');
  const c = commit(repo, 'c');
  const run = gitOf(repo);
  assert.deepEqual(newCommits(run, a, c), [b, c]);
  assert.deepEqual(newCommits(run, c, c), []);
  assert.deepEqual(newCommits(run, undefined, c), [c]);
  git(repo, 'reset', '-q', '--hard', a);
  const d = commit(repo, 'd');
  assert.deepEqual(newCommits(run, c, d), [d]);
});

test('mirrorCommit writes the verdict file and a readable line', async () => {
  const repo = tempGitRepo('next-mirror-');
  commit(repo, 'a');
  const sha = commit(repo, 'b');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  try {
    const calls = [];
    const remote = async (call) => {
      calls.push(call);
      writeFileSync(call.log, `[remote-run] rack\npush-suite: blocked lint failed at ${sha}\n`);
      return 1;
    };
    const verdict = await mirrorCommit({ repo, sha, dir, remote });
    assert.equal(verdict.status, 'red');
    assert.equal(verdict.step, 'lint');
    assert.match(calls[0].suite, new RegExp(`[0-9a-f]{40}\\.\\.${sha}$`));
    assert.deepEqual(JSON.parse(readFileSync(join(dir, `${sha}.json`), 'utf8')).status, 'red');
    assert.match(readFileSync(join(dir, 'latest.txt'), 'utf8'), new RegExp(`${sha.slice(0, 12)} RED \\[lint\\] add b`));
    assert.equal(readFileSync(join(dir, 'verdicts.log'), 'utf8').split('\n').filter(Boolean).length, 1);
    assert.equal(existsSync(join(dir, 'running.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mirrorCommit runs no suite for a root commit', async () => {
  const repo = tempGitRepo('next-mirror-');
  const sha = commit(repo, 'a');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  try {
    const verdict = await mirrorCommit({ repo, sha, dir, remote: async () => assert.fail('no remote run') });
    assert.deepEqual([verdict.status, verdict.step], ['error', 'no parent commit']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
