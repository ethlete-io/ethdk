#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasOkVerdict, releaseSlot } from './push-slot.mjs';
import { firstParentLog, reusedVerdictLine, verdictBelow } from './verdict-reuse.mjs';

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

const fastChecks = async (base, head) => (await import('./push-suite.mjs')).preChecksStep(`${base}..${head}`);

export const pushableVerdict = async ({ cwd, sha, hasVerdict, checks = fastChecks, log }) => {
  if (hasVerdict(sha)) return { ok: true };
  const below = verdictBelow(firstParentLog(cwd, sha), hasVerdict);
  if (!below.sha) {
    log(
      below.blocker
        ? `push-next: no push-suite ok verdict for ${sha.slice(0, 12)}, and ${below.blocker.slice(0, 9)} changes ${below.file}, more than docs. Run \`yarn push:suite\` first.`
        : `push-next: no push-suite ok verdict for ${sha.slice(0, 12)} or an ancestor. Run \`yarn push:suite\` first.`,
    );
    return { ok: false };
  }
  const checked = await checks(below.sha, sha);
  if (checked.status !== 0) {
    if (checked.output) log(checked.output);
    log(
      `push-next: the fast checks failed (${checked.names.join(', ')}) on the docs-only commits above ${below.sha.slice(0, 9)}.`,
    );
    return { ok: false };
  }
  log(reusedVerdictLine('push-next', below));
  return { ok: true };
};

/** Pushes HEAD to `next` once push-suite passed for it, then releases the push slot. Returns the exit code. */
export const pushNext = async ({
  cwd,
  remote = 'origin',
  branch = 'next',
  holder,
  hasVerdict = (sha) => hasOkVerdict(cwd, sha),
  checks,
  dryRun = false,
  log = console.error,
}) => {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim();
  for (const line of uncommittedDesignRecordLines({ cwd })) log(line);
  if (!(await pushableVerdict({ cwd, sha, hasVerdict, checks, log })).ok) return 1;
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
  process.exit(
    await pushNext({ cwd: resolve(import.meta.dirname, '../..'), dryRun: process.argv.includes('--dry-run') }),
  );
}
