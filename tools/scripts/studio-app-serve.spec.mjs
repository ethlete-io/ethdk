import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAppServer } from './studio-app-serve.mjs';
import { ensureAppCopy } from './studio-code.mjs';
import { gitSpawn } from './git-test-env.mjs';

const quiet = () => undefined;

const git = (cwd, ...args) => {
  const result = gitSpawn(args, { cwd, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);

  return result.stdout.trim();
};

const fakeBuild = (root, tree) => {
  const dir = join(tree, 'dist/apps/ethlete-studio/browser');

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), readFileSync(join(tree, 'apps/ethlete-studio/src/main.ts')));
  writeFileSync(join(dir, 'index.html'), '<script src="main.js"></script>\n');
};

const served = async (root, path) => {
  const server = createAppServer(root);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);

    return { status: response.status, body: await response.text() };
  } finally {
    server.close();
  }
};

test('an uncommitted Studio app edit never reaches the served app', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-app-spec-'));
  const main = join(root, 'apps/ethlete-studio/src/main.ts');

  try {
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'spec@example.com');
    git(root, 'config', 'user.name', 'spec');
    mkdirSync(join(root, 'apps/ethlete-studio/src'), { recursive: true });
    writeFileSync(main, 'committed one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'one');
    writeFileSync(main, 'uncommitted\n');

    const first = ensureAppCopy(root, { log: quiet, build: fakeBuild });

    assert.equal(first.sha, git(root, 'rev-parse', 'HEAD'));
    assert.equal(first.switched, false);
    assert.equal((await served(root, '/main.js')).body, 'committed one\n');
    assert.match((await served(root, '/pages/start')).body, /main\.js/);
    assert.equal((await served(root, '/..%2F..%2F.git%2Fconfig')).status, 404);

    writeFileSync(main, 'committed two\n');
    git(root, 'commit', '-qam', 'two');
    writeFileSync(main, 'uncommitted again\n');

    const second = ensureAppCopy(root, { log: quiet, build: fakeBuild });

    assert.equal(second.switched, true);
    assert.equal((await served(root, '/main.js')).body, 'committed two\n');
    assert.equal(ensureAppCopy(root, { log: quiet, build: () => assert.fail('rebuilt') }).switched, false);
  } finally {
    gitSpawn(['worktree', 'prune'], { cwd: root });
    rmSync(root, { recursive: true, force: true });
  }
});

test('a libs-only commit switches the copy and only the current and previous copies stay', () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-app-spec-'));
  const core = join(root, 'libs/core/index.ts');
  const hostFile = join(root, 'apps/ethlete-studio/src-tauri/main.rs');

  try {
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'spec@example.com');
    git(root, 'config', 'user.name', 'spec');
    mkdirSync(join(root, 'apps/ethlete-studio/src-tauri'), { recursive: true });
    mkdirSync(join(root, 'apps/ethlete-studio/src'), { recursive: true });
    mkdirSync(join(root, 'libs/core'), { recursive: true });
    writeFileSync(join(root, 'apps/ethlete-studio/src/main.ts'), 'app\n');
    writeFileSync(core, 'one\n');
    writeFileSync(hostFile, 'one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'one');

    const first = ensureAppCopy(root, { log: quiet, build: fakeBuild });

    writeFileSync(core, 'two\n');
    git(root, 'commit', '-qam', 'two');

    const second = ensureAppCopy(root, { log: quiet, build: fakeBuild });

    assert.equal(second.switched, true);
    assert.equal(second.sha, git(root, 'rev-parse', 'HEAD'));

    writeFileSync(hostFile, 'two\n');
    git(root, 'commit', '-qam', 'host only');

    assert.equal(ensureAppCopy(root, { log: quiet, build: fakeBuild }).sha, second.sha);

    writeFileSync(core, 'three\n');
    git(root, 'commit', '-qam', 'three');

    const third = ensureAppCopy(root, { log: quiet, build: fakeBuild });
    const copies = readdirSync(join(root, 'tmp/studio-app')).filter((name) => /^[0-9a-f]{40}$/.test(name));

    assert.deepEqual(copies.sort(), [second.sha, third.sha].sort());
    assert.notEqual(first.sha, second.sha);
  } finally {
    gitSpawn(['worktree', 'prune'], { cwd: root });
    rmSync(root, { recursive: true, force: true });
  }
});
