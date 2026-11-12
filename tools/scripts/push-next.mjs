#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { releaseSlot } from './push-slot.mjs';

const DESIGN_RECORD = /^\.ethlete\/design\/[^/]+\/(ready|merged)\.json$/;

/** One line per uncommitted design record file (`ready.json`, `merged.json`) with the age of its last write. */
export const uncommittedDesignRecordLines = ({ cwd, now = Date.now() }) =>
  spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', '.ethlete/design'], {
    cwd,
    encoding: 'utf8',
  })
    .stdout.split('\n')
    .map((line) => line.slice(3))
    .filter((path) => DESIGN_RECORD.test(path))
    .map((path) => {
      const minutes = Math.floor((now - statSync(join(cwd, path)).mtimeMs) / 60_000);

      return `push-next: ${path} is uncommitted, last written ${minutes} min ago; commit it before a merge refuses it.`;
    });

/** Pushes HEAD to `next`, then releases the push slot. Returns the exit code. */
export const pushNext = ({ cwd, remote = 'origin', branch = 'next', holder, dryRun = false, log = console.error }) => {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim();
  for (const line of uncommittedDesignRecordLines({ cwd })) log(line);
  if (dryRun) {
    log(`push-next: --dry-run, would push ${sha.slice(0, 12)} to ${remote} ${branch}`);
    return 0;
  }
  const pushed = spawnSync('git', ['push', remote, `${sha}:${branch}`], { cwd, stdio: 'inherit' });
  if (pushed.status !== 0) {
    log('push-next: push failed, the push slot stays held.');
    return pushed.status || 1;
  }
  const released = releaseSlot({ cwd, holder, remote, branch });
  log(released.ok ? 'push slot released' : `push slot not released: ${released.reason ?? 'held by another builder'}`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exit(pushNext({ cwd: resolve(import.meta.dirname, '../..'), dryRun: process.argv.includes('--dry-run') }));
}
