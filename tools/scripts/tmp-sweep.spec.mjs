import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import { isSweptTmpName, sweepTargets, unitFiles } from './tmp-sweep.mjs';

const HOUR = 60 * 60 * 1000;
const now = Date.now();
const old = (path) => {
  const time = new Date(now - 7 * HOUR);
  utimesSync(path, time, time);
};

test('the /tmp names it sweeps are our test folders, and caches stay', () => {
  for (const name of [
    'tmp-2431782-0rWhoB7wFpK9',
    'et-design-visible-change-AbC123',
    'cli-design-system-x1Y2z3',
    'studio-canvas-e2e-build-q',
    'commit-export-spec-abc',
    'playwright-artifacts-Xyz789',
    'archive-cli-a1B2c3',
    'wf-ZtN0x1',
  ])
    assert.ok(isSweptTmpName(name), name);
  for (const name of [
    'node-compile-cache',
    'et-design-harness-cache',
    'jest_rs',
    'claude-1000',
    'et-design',
    'wf-toolong1',
    'archive-cli-a1B2c3-extra',
    'yarn--1794358690848-0.32',
    'playwright_chromiumdev_profile-abc',
    'e2e-tokens-abcdef',
    'cli1-tsc',
  ])
    assert.ok(!isSweptTmpName(name), name);
});

test('a /tmp folder goes only when nothing in it changed for 6 h and no process uses it', () => {
  const tmpRoot = tempDir('tmp-sweep-root-');
  const make = (name, fresh = false) => {
    const dir = join(tmpRoot, name);
    mkdirSync(dir);
    writeFileSync(join(dir, 'f'), '');
    if (!fresh) old(join(dir, 'f'));
    old(dir);
    return dir;
  };
  const stale = make('cli-stale-aaaaaa');
  make('cli-fresh-inside-bbbbbb', true);
  const used = make('cli-used-cccccc');
  make('node-compile-cache');
  make('unknown-dddddd');

  const targets = sweepTargets({ tmpRoot, now, openPaths: [join(used, 'f')] });

  assert.deepEqual(targets, [stale]);
});

test('in the Claude temp dir stale entries go at any depth, while a live session dir stays', () => {
  const claudeTmp = tempDir('tmp-sweep-claude-');
  const live = join(claudeTmp, 'claude-1000', 'project', 'live-session');
  const ended = join(claudeTmp, 'claude-1000', 'project', 'ended-session');
  mkdirSync(join(live, 'tasks'), { recursive: true });
  mkdirSync(join(ended, 'tasks'), { recursive: true });
  writeFileSync(join(live, 'tasks', 'now.output'), '');
  writeFileSync(join(live, 'tasks', 'old.output'), '');
  writeFileSync(join(live, 'tasks', 'open.output'), '');
  writeFileSync(join(ended, 'tasks', 'a.output'), '');
  for (const path of [
    join(live, 'tasks', 'old.output'),
    join(live, 'tasks', 'open.output'),
    join(ended, 'tasks', 'a.output'),
    join(ended, 'tasks'),
    ended,
  ])
    old(path);

  const targets = sweepTargets({
    tmpRoot: tempDir('tmp-sweep-empty-'),
    claudeTmp,
    now,
    openPaths: [join(live, 'tasks', 'open.output')],
  });

  assert.deepEqual(targets.sort(), [ended, join(live, 'tasks', 'old.output')].sort());
});

test('the units run the sweep hourly with the given node', () => {
  const files = unitFiles({ node: '/n/node', script: '/r/tmp-sweep.mjs' });

  assert.match(files['ethlete-tmp-sweep.service'], /^ExecStart=\/n\/node \/r\/tmp-sweep\.mjs$/m);
  assert.match(files['ethlete-tmp-sweep.timer'], /^OnCalendar=hourly$/m);
  assert.match(files['ethlete-tmp-sweep.timer'], /^WantedBy=timers\.target$/m);
});
