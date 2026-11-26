import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, it } from 'node:test';
import { git } from './git-test-env.mjs';

const hook = join(import.meta.dirname, 'spec-tmp-hook.mjs');
const slotModule = join(import.meta.dirname, 'push-slot.mjs');
const gitEnvModule = join(import.meta.dirname, 'git-test-env.mjs');
const root = mkdtempSync(join(tmpdir(), 'no-real-remote-'));

after(() => rmSync(root, { recursive: true, force: true }));

const initWithOrigin = (name) => {
  const origin = join(root, `${name}-origin.git`);
  const repo = join(root, name);

  git(root, 'init', '--bare', '-q', origin);
  git(root, 'init', '-q', '-b', 'next', repo);
  git(repo, 'config', 'user.email', 'a@b.c');
  git(repo, 'config', 'user.name', 'a');
  git(repo, 'commit', '--allow-empty', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', origin);

  return { origin, repo };
};

it('a spec run under a hook GIT_DIR claims the push slot on its own temp remote, never the real one', () => {
  const real = initWithOrigin('real');
  const temp = initWithOrigin('temp');
  const fixture = join(root, 'claims-slot.spec.mjs');

  writeFileSync(
    fixture,
    `import { it } from 'node:test';
import { git } from ${JSON.stringify(gitEnvModule)};
import { claimSlot } from ${JSON.stringify(slotModule)};
it('claims', () => {
  const result = claimSlot({ cwd: ${JSON.stringify(temp.repo)}, holder: 'spec', sha: git(${JSON.stringify(temp.repo)}, 'rev-parse', 'HEAD'), log: () => {} });
  if (!result.ok) throw new Error('claim failed');
});
`,
  );

  const env = { ...process.env, GIT_DIR: join(real.repo, '.git'), GIT_WORK_TREE: real.repo };

  delete env['NODE_TEST_CONTEXT'];

  const run = spawnSync(process.execPath, ['--import', hook, '--test', fixture], { cwd: root, env, encoding: 'utf8' });

  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(git(real.origin, 'for-each-ref', 'refs/push-slot'), '', 'the real remote got a slot ref');
  assert.match(git(temp.origin, 'for-each-ref', 'refs/push-slot'), /refs\/push-slot\/next/);
});
