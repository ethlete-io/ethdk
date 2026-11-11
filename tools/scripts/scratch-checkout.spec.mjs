import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { scopeSelfLinks, scopeSelfLinksMessage } from './commit-export.mjs';
import { gitEnv } from './git-test-env.mjs';
import { scratchCheckout } from './scratch-checkout.mjs';

const makeRepo = () => {
  const repo = mkdtempSync(join(tmpdir(), 'scratch-spec-'));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env: gitEnv(), encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(repo, 'a.txt'), 'committed');
  git('add', 'a.txt');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  mkdirSync(join(repo, 'node_modules/@types/node'), { recursive: true });
  mkdirSync(join(repo, 'node_modules/@babel/core'), { recursive: true });
  return repo;
};

const listing = (dir) => readdirSync(dir, { recursive: true }).sort();

test('scopeSelfLinks passes a clean node_modules', () => {
  const repo = makeRepo();
  assert.deepEqual(scopeSelfLinks(repo), []);
  rmSync(repo, { recursive: true, force: true });
});

test('scopeSelfLinks names a planted scope self-link', () => {
  const repo = makeRepo();
  const link = join(repo, 'node_modules/@types/@types');
  symlinkSync(join(repo, 'node_modules/@types'), link);
  assert.deepEqual(scopeSelfLinks(repo), [link]);
  assert.match(scopeSelfLinksMessage([link]), new RegExp(link));
  rmSync(repo, { recursive: true, force: true });
});

test('scopeSelfLinks flags a link to an ancestor and ignores a link to a sibling', () => {
  const repo = makeRepo();
  const up = join(repo, 'node_modules/@babel/up');
  symlinkSync('../../node_modules', up);
  symlinkSync('../@types/node', join(repo, 'node_modules/@babel/node'));
  assert.deepEqual(scopeSelfLinks(repo), [up]);
  rmSync(repo, { recursive: true, force: true });
});

test('scratchCheckout copies uncommitted edits, links dependencies and leaves node_modules unchanged', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, 'a.txt'), 'edited');
  writeFileSync(join(repo, 'b.txt'), 'untracked');
  const before = listing(join(repo, 'node_modules'));
  const dir = join(mkdtempSync(join(tmpdir(), 'scratch-out-')), 'copy');
  assert.deepEqual(scratchCheckout(repo, dir), { dir });
  assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), 'edited');
  assert.equal(readFileSync(join(dir, 'b.txt'), 'utf8'), 'untracked');
  assert.equal(lstatSync(join(dir, 'node_modules/@types/node')).isSymbolicLink(), true);
  assert.deepEqual(listing(join(repo, 'node_modules')), before);
  assert.deepEqual(scopeSelfLinks(repo), []);
  rmSync(repo, { recursive: true, force: true });
  rmSync(join(dir, '..'), { recursive: true, force: true });
});
