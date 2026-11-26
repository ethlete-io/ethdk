import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { git, gitSpawn, tempGitRepo } from './git-test-env.mjs';
import {
  cleanGitEnv,
  mirrorCommit,
  mirrorSuite,
  newCommits,
  parseArgs,
  retryable,
  runningState,
  serviceUnit,
  verdictOf,
  watch,
} from './next-mirror.mjs';

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

test('runningState reports a record whose process is gone as died', () => {
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  try {
    assert.equal(runningState(dir), undefined);
    writeFileSync(join(dir, 'running.json'), JSON.stringify({ sha: 'abc', pid: 2 ** 22 + 12345 }));
    assert.equal(runningState(dir).state, 'died');
    writeFileSync(join(dir, 'running.json'), JSON.stringify({ sha: 'abc', pid: process.pid }));
    assert.equal(runningState(dir).state, 'running');
    writeFileSync(join(dir, 'running.json'), JSON.stringify({ sha: 'abc' }));
    assert.equal(runningState(dir).state, 'died');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mirrorCommit records its own pid while running', async () => {
  const repo = tempGitRepo('next-mirror-');
  commit(repo, 'a');
  const sha = commit(repo, 'b');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  try {
    let seen;
    await mirrorCommit({
      repo,
      sha,
      dir,
      remote: async () => {
        seen = runningState(dir);
        return 0;
      },
    });
    assert.deepEqual([seen.state, seen.record.pid], ['running', process.pid]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const until = async (check, ms = 10_000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) assert.fail('timed out');
    await new Promise((done) => setTimeout(done, 20));
  }
};

test('watch mirrors a new commit on the branch once and writes its verdict', async () => {
  const repo = tempGitRepo('next-mirror-');
  const first = commit(repo, 'a');
  const branch = git(repo, 'branch', '--show-current');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  const stop = new AbortController();
  const mirrored = [];
  const remote = async ({ sha, log }) => {
    mirrored.push(sha);
    writeFileSync(log, `push-suite: ok ${sha}\n`);
    return 0;
  };
  const watching = watch({ repo, branch, every: 0.02, dir, log: () => undefined, remote, signal: stop.signal });
  try {
    await until(() => existsSync(join(dir, 'state.json')));
    assert.equal(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).last, first);
    const second = commit(repo, 'b');
    await until(() => existsSync(join(dir, `${second}.json`)));
    await new Promise((done) => setTimeout(done, 200));
    assert.deepEqual(mirrored, [second]);
    assert.equal(JSON.parse(readFileSync(join(dir, `${second}.json`), 'utf8')).status, 'green');
  } finally {
    stop.abort();
    await watching;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a watcher without state, as after a reboot cleared /tmp, judges the head once', async () => {
  const repo = tempGitRepo('next-mirror-');
  commit(repo, 'a');
  const head = commit(repo, 'b');
  const branch = git(repo, 'branch', '--show-current');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  const mirrored = [];
  const remote = async ({ sha, log }) => {
    mirrored.push(sha);
    writeFileSync(log, `push-suite: ok ${sha}\n`);
    return 0;
  };
  const watchOnce = async () => {
    const stop = new AbortController();
    const watching = watch({ repo, branch, every: 0.02, dir, log: () => undefined, remote, signal: stop.signal });
    try {
      await until(() => existsSync(join(dir, `${head}.json`)), 2000);
      await new Promise((done) => setTimeout(done, 100));
    } finally {
      stop.abort();
      await watching;
    }
  };
  try {
    await watchOnce();
    rmSync(join(dir, 'state.json'));
    await watchOnce();
    assert.deepEqual(mirrored, [head]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the service unit restarts the watcher on the given repo', () => {
  const unit = serviceUnit({ node: '/n/node', script: '/r/next-mirror.mjs', repo: '/r' });
  assert.match(unit, /^ExecStart=\/n\/node \/r\/next-mirror\.mjs watch --repo \/r$/m);
  assert.match(unit, /^Restart=always$/m);
  assert.match(unit, /^WantedBy=default\.target$/m);
});

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'next-mirror');

for (const [fixture, step] of [
  ['lint-red.log', 'lint'],
  ['coverage-red.log', 'coverage'],
]) {
  test(`a rack run whose ${step} step fails gives a red verdict`, async () => {
    const repo = tempGitRepo('next-mirror-');
    commit(repo, 'a');
    const sha = commit(repo, 'b');
    const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
    try {
      const remote = async ({ log }) => {
        writeFileSync(log, readFileSync(join(FIXTURES, fixture), 'utf8'));
        return 1;
      };
      const verdict = await mirrorCommit({ repo, sha, dir, remote });
      assert.deepEqual([verdict.status, verdict.step], ['red', step]);
      assert.equal(JSON.parse(readFileSync(join(dir, `${sha}.json`), 'utf8')).status, 'red');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('watch retries an ERROR verdict once, keeps RED and green, and stops after the retry', async () => {
  const repo = tempGitRepo('next-mirror-');
  commit(repo, 'a');
  const branch = git(repo, 'branch', '--show-current');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  const calls = {};
  let current;
  const remote = async ({ sha, log }) => {
    calls[sha] = (calls[sha] ?? 0) + 1;
    const kind = current[sha] === 'error' && calls[sha] > 1 ? 'fixed' : current[sha];
    if (kind === 'red') writeFileSync(log, 'push-suite: blocked lint failed at abc123\n');
    else if (kind !== 'error') writeFileSync(log, `push-suite: ok ${sha}\n`);
    return kind === 'error' ? 255 : 0;
  };
  const stop = new AbortController();
  const watching = watch({
    repo,
    branch,
    every: 0.02,
    dir,
    log: () => undefined,
    remote,
    retryAfter: 0,
    reachable: () => true,
    signal: stop.signal,
  });
  try {
    await until(() => existsSync(join(dir, 'state.json')));
    const errored = commit(repo, 'b');
    const red = commit(repo, 'c');
    const green = commit(repo, 'd');
    current = { [errored]: 'error', [red]: 'red', [green]: 'green' };
    await until(() => existsSync(join(dir, `${green}.json`)));
    await until(() => JSON.parse(readFileSync(join(dir, `${errored}.json`), 'utf8')).status === 'green', 2000);
    await new Promise((done) => setTimeout(done, 200));
    assert.equal(calls[errored], 2);
    assert.equal(calls[red], 1);
    assert.equal(calls[green], 1);
    assert.equal(JSON.parse(readFileSync(join(dir, `${errored}.json`), 'utf8')).attempt, 2);
  } finally {
    stop.abort();
    await watching;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an ERROR that already had its retry stays final', () => {
  const repo = tempGitRepo('next-mirror-');
  const sha = commit(repo, 'a');
  const dir = mkdtempSync(join(tmpdir(), 'next-mirror-out-'));
  const write = (attempt) =>
    writeFileSync(
      join(dir, `${sha}.json`),
      JSON.stringify({ sha, status: 'error', attempt, finishedAt: new Date(Date.now() - 120000).toISOString() }),
    );
  try {
    write(1);
    assert.deepEqual(retryable(gitOf(repo), sha, dir), [sha]);
    assert.deepEqual(retryable(gitOf(repo), sha, dir, { after: 600 }), []);
    write(2);
    assert.deepEqual(retryable(gitOf(repo), sha, dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
