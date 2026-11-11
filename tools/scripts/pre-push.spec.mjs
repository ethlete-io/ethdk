import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gitSpawn } from './git-test-env.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.husky', 'pre-push');
const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const git = (cwd, ...args) => gitSpawn(args, { cwd, encoding: 'utf8' }).stdout.trim();

const stub = (path, body) => {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
};

const setup = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pre-push-')));
  created.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'a@b.c');
  git(dir, 'config', 'user.name', 'a');
  writeFileSync(join(dir, 'a.txt'), 'a');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');
  mkdirSync(join(dir, 'apps', 'docs'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'docs', 'x.md'), 'x');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'docs');
  const head = git(dir, 'rev-parse', 'HEAD');
  const bin = join(dir, '.bin');
  mkdirSync(bin);
  mkdirSync(join(dir, '.husky'));
  writeFileSync(join(dir, '.husky', 'format-check-committed.mjs'), '');
  const log = join(dir, '.bin', 'yarn.log');
  stub(join(bin, 'yarn'), `echo "$@" >> "${log}"`);
  stub(join(bin, 'node'), 'exit 0');
  return { dir, base, head, bin, log };
};

const push = ({ dir, base, head, bin }) =>
  spawnSync('sh', [hook], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    input: `refs/heads/next ${head} refs/heads/next ${base}\n`,
  });

test('builds the docs once per pushed sha', () => {
  const ctx = setup();
  assert.equal(push(ctx).status, 0);
  assert.equal(push(ctx).status, 0);
  const builds = readFileSync(ctx.log, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('vitepress build'));
  assert.equal(builds.length, 1);
});
