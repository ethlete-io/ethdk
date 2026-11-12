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
import { removeScratch, scratchArgsOf, scratchCheckout, storeEscapes } from './scratch-checkout.mjs';

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

test('scratchCheckout gives the scratch its own shot store, never a link into the source', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  mkdirSync(join(repo, 'node_modules/.design-explore/live'), { recursive: true });
  writeFileSync(join(repo, 'node_modules/.design-explore/live/shot.png'), 'live');
  const dir = join(mkdtempSync(join(tmpdir(), 'scratch-out-')), 'copy');
  assert.deepEqual(scratchCheckout(repo, dir), { dir });
  const store = join(dir, 'node_modules/.design-explore');
  assert.equal(lstatSync(store).isSymbolicLink(), false);
  assert.deepEqual(readdirSync(store), []);
  writeFileSync(join(store, 'scratch.png'), 'scratch');
  assert.deepEqual(readdirSync(join(repo, 'node_modules/.design-explore')), ['live']);
  assert.equal(storeEscapes(repo, dir), undefined);
  rmSync(repo, { recursive: true, force: true });
  rmSync(join(dir, '..'), { recursive: true, force: true });
});

test('storeEscapes names a store that resolves into the source checkout', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, 'node_modules/.design-explore'), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'scratch-out-'));
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(join(repo, 'node_modules/.design-explore'), join(dir, 'node_modules/.design-explore'));
  assert.match(storeEscapes(repo, dir), /inside the main checkout/);
  rmSync(repo, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('scratchArgsOf takes no flag for a dir, keeps scratch copies out of the temp dir and defaults to the home disk', () => {
  const where = { home: '/home/u', temp: '/tmp', now: 7 };
  assert.equal(scratchArgsOf(['--help'], where).code, 0);
  assert.equal(scratchArgsOf(['-x'], where).code, 2);
  assert.equal(scratchArgsOf(['/tmp/copy'], where).code, 2);
  assert.equal(scratchArgsOf(['/tmp'], where).code, 2);
  assert.deepEqual(scratchArgsOf(['/tmpfoo'], where), { dir: '/tmpfoo' });
  assert.deepEqual(scratchArgsOf([], where), { dir: '/home/u/.cache/ethlete-scratch/scratch-7' });
  assert.deepEqual(scratchArgsOf(['--remove', '/home/u/s'], where), { remove: '/home/u/s' });
  assert.equal(scratchArgsOf(['--remove'], where).code, 2);
});

test('removeScratch removes a scratch copy and refuses any other dir', () => {
  const repo = makeRepo();
  const other = mkdtempSync(join(tmpdir(), 'scratch-other-'));
  const dir = join(mkdtempSync(join(tmpdir(), 'scratch-out-')), 'copy');
  scratchCheckout(repo, dir);

  assert.match(removeScratch(other).error, /no scratch checkout/);
  assert.equal(readdirSync(other).length, 0);
  assert.deepEqual(removeScratch(dir), { removed: dir });
  assert.throws(() => readdirSync(dir));
  rmSync(repo, { recursive: true, force: true });
  rmSync(other, { recursive: true, force: true });
  rmSync(join(dir, '..'), { recursive: true, force: true });
});
