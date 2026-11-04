import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cliCopyPlan, ensureCliCopy } from './studio-code.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('a dirty libs/cli builds the last commit when the kept copy is older', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: true, copies: [A, C], distMatches: true }), {
    action: 'build',
    sha: B,
  });
});

test('a dirty libs/cli without any copy builds the committed state', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: true, copies: [], distMatches: true }), {
    action: 'build',
    sha: B,
  });
});

test('a dirty libs/cli keeps the copy of the last commit', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: true, copies: [A, B], distMatches: true }), {
    action: 'use',
    sha: B,
  });
});

test('a clean libs/cli takes the build when it matches the commit', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: false, copies: [A], distMatches: true }), {
    action: 'copy',
    sha: B,
  });
});

test('a clean libs/cli whose build does not match builds the commit', () => {
  assert.deepEqual(cliCopyPlan({ latest: B, dirty: false, copies: [A], distMatches: false }), {
    action: 'build',
    sha: B,
  });
});

const quiet = () => undefined;

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);

  return result.stdout.trim();
};

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();

      server.close(() => resolve(port));
    });
  });

const canConnect = (port) =>
  new Promise((resolve) => {
    const client = connect(port, '127.0.0.1');

    client.on('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
  });

const waitForPort = async (port) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await canConnect(port)) return true;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
};

const fakeBuild = (root, tree) => {
  const dir = join(tree, 'dist/libs/cli/src');

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.js'),
    `require('node:net').createServer().listen(Number(process.argv[2]), '127.0.0.1');\n`,
  );
};

test('a dirty libs/cli with a copy without a pinned commit still serves the last commit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-code-spec-'));
  let server;

  try {
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'spec@example.com');
    git(root, 'config', 'user.name', 'spec');
    mkdirSync(join(root, 'libs/cli'), { recursive: true });
    writeFileSync(join(root, 'libs/cli/file.txt'), 'one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'init');

    const latest = git(root, 'rev-parse', 'HEAD');
    const unpinned = join(root, 'tmp/studio-cli', latest);

    mkdirSync(join(unpinned, 'src'), { recursive: true });
    writeFileSync(join(unpinned, 'src/index.js'), 'throw new Error("stale copy");\n');
    writeFileSync(join(root, 'libs/cli/file.txt'), 'two\n');

    const copy = ensureCliCopy(root, { log: quiet, build: fakeBuild });

    assert.equal(copy.sha, latest);
    assert.equal(copy.dirty, true);
    assert.ok(existsSync(join(unpinned, 'pinned-commit')));

    const port = await freePort();

    server = spawn(process.execPath, [copy.entry, String(port)], { stdio: 'ignore' });

    assert.equal(await waitForPort(port), true);
  } finally {
    server?.kill();
    spawnSync('git', ['worktree', 'prune'], { cwd: root });
    rmSync(root, { recursive: true, force: true });
  }
});

test('a clean libs/cli without dist/libs/cli builds the last commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-code-spec-'));

  try {
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'spec@example.com');
    git(root, 'config', 'user.name', 'spec');
    mkdirSync(join(root, 'libs/cli'), { recursive: true });
    writeFileSync(join(root, 'libs/cli/file.txt'), 'one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'init');

    const copy = ensureCliCopy(root, { log: quiet, build: fakeBuild });

    assert.equal(copy.sha, git(root, 'rev-parse', 'HEAD'));
    assert.equal(copy.dirty, false);
    assert.ok(existsSync(copy.entry));
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: root });
    rmSync(root, { recursive: true, force: true });
  }
});
