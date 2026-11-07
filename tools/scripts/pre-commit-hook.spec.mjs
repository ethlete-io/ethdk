import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the pre-commit hook sees the paths of `git commit -- <paths>`, not the whole working tree', () => {
  const repo = mkdtempSync(join(tmpdir(), 'pre-commit-paths-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  const hook = readFileSync(join(root, '.husky', 'pre-commit'), 'utf8');
  const log = join(repo, '.hook-log');

  try {
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 't'],
      ['config', 'user.email', 't@t.t'],
      ['config', 'commit.gpgsign', 'false'],
      ['config', 'core.hooksPath', '.husky'],
    ]) {
      assert.equal(git(...args).status, 0);
    }

    mkdirSync(join(repo, '.husky'));
    mkdirSync(join(repo, 'tools', 'scripts'), { recursive: true });
    writeFileSync(join(repo, '.husky', 'pre-commit'), hook);
    chmodSync(join(repo, '.husky', 'pre-commit'), 0o755);
    for (const [, script] of hook.matchAll(/node \.\/tools\/scripts\/(\S+)/g)) {
      writeFileSync(
        join(repo, 'tools', 'scripts', script),
        `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, ${JSON.stringify(script)} + ' ' + process.argv.slice(2).join(' ') + '\\n');\n`,
      );
    }

    mkdirSync(join(repo, '.changeset'));
    mkdirSync(join(repo, 'src'));
    writeFileSync(join(repo, '.changeset', 'a.md'), 'a\n');
    writeFileSync(join(repo, '.changeset', 'b.md'), 'b\n');
    writeFileSync(join(repo, 'src', 'a.css'), 'a {}\n');
    writeFileSync(join(repo, 'src', 'b.css'), 'b {}\n');
    git('add', '.');
    assert.equal(git('commit', '-qm', 'base', '--no-verify').status, 0);
    for (const file of ['.changeset/a.md', '.changeset/b.md', 'src/a.css', 'src/b.css']) {
      writeFileSync(join(repo, file), 'changed\n');
    }
    writeFileSync(log, '');

    const result = git('commit', '-qm', 'paths', '--', '.changeset/a.md', 'src/a.css');

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const calls = readFileSync(log, 'utf8');
    assert.match(calls, /lint-changesets\.js \.changeset\/a\.md\n/);
    assert.match(calls, /lint-css-properties\.js src\/a\.css\n/);
    assert.doesNotMatch(calls, /b\.md|b\.css/);
    assert.deepEqual(git('show', '--name-only', '--format=', 'HEAD').stdout.trim().split('\n').sort(), [
      '.changeset/a.md',
      'src/a.css',
    ]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
