import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { KEPT_TMP_NAMES } from './tmp-sweep.mjs';

export const SPEC_TMP_PREFIX = 'et-spec-';

const uid = process.getuid?.() ?? 0;
const CACHES = [...KEPT_TMP_NAMES, `swc-node-${uid}`, `v8-compile-cache-${uid}`];
const NEVER_COUNTED = [/^yarn--/, /^xfs-/, /^claude-\d+$/];

export const isCountedTmpName = (name) =>
  !CACHES.includes(name) && !NEVER_COUNTED.some((pattern) => pattern.test(name));

/**
 * A fresh temp dir for one spec file or one push-suite step. Point `TMPDIR` at `dir` while it runs: only that run's own
 * process tree sees it, so `close()` lists exactly what the run left behind, then removes the dir. The kept caches stay
 * shared through links to the parent's copies.
 */
export const openSpecTmp = (parent = tmpdir()) => {
  const dir = mkdtempSync(join(parent, SPEC_TMP_PREFIX));

  for (const name of CACHES)
    if (existsSync(join(parent, name))) symlinkSync(join(parent, name), join(dir, name), 'dir');

  return {
    dir,
    close: () => {
      const left = readdirSync(dir).filter(isCountedTmpName).sort();

      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

      return left;
    },
  };
};

export const leakMessageOf = (who, left, cwd = process.cwd()) => {
  const name = who.startsWith('/') ? relative(cwd, who) : who;
  const shown = left.slice(0, 5).join(', ') + (left.length > 5 ? `, and ${left.length - 5} more` : '');

  return `tmp leak: ${name} left ${left.length} folder${left.length === 1 ? '' : 's'} in /tmp (${shown}). Remove each temp folder it creates when it is done (ADR 0275).`;
};
