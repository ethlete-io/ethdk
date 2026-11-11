#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasOkVerdict, releaseSlot } from './push-slot.mjs';

/** Pushes HEAD to `next` once push-suite passed for it, then releases the push slot. Returns the exit code. */
export const pushNext = ({
  cwd,
  remote = 'origin',
  branch = 'next',
  holder,
  hasVerdict = (sha) => hasOkVerdict(cwd, sha),
  log = console.error,
}) => {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim();
  if (!hasVerdict(sha)) {
    log(`push-next: no push-suite ok verdict for ${sha.slice(0, 12)}. Run \`yarn push:suite\` first.`);
    return 1;
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
  process.exit(pushNext({ cwd: resolve(import.meta.dirname, '../..') }));
}
