#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export const parseBiteArgs = (argv) => {
  const [ref, ...rest] = argv;
  if (!ref || ref.startsWith('--')) return { error: 'usage: studio-e2e-bite.mjs <git-ref-before-the-fix> [e2e args]' };

  return { ref, e2eArgs: rest };
};

export const biteVerdict = (status) =>
  status === 0
    ? { bites: false, message: 'the e2e passes on the old CLI: the new case does not bite' }
    : { bites: true, message: 'the e2e fails on the old CLI: the new case bites' };

const main = () => {
  const parsed = parseBiteArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(2);
  }

  const scratch = mkdtempSync(join(tmpdir(), 'studio-e2e-bite-'));
  const old = join(scratch, 'old');
  const env = { ...process.env, NX_NO_CLOUD: 'true' };

  try {
    execFileSync('git', ['worktree', 'add', '--detach', old, parsed.ref], { cwd: root, stdio: 'inherit' });
    if (!existsSync(join(old, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(old, 'node_modules'));
    execFileSync('npx', ['nx', 'build', 'cli', '--skip-nx-cache'], { cwd: old, stdio: 'inherit', env });

    const entry = join(old, 'dist/libs/cli/src/index.js');
    const run = spawnSync(process.execPath, [join(root, 'apps/ethlete-studio/e2e/canvas.e2e.mjs'), ...parsed.e2eArgs], {
      cwd: root,
      stdio: 'inherit',
      env: { ...env, STUDIO_CLI_ENTRY: entry },
    });
    const verdict = biteVerdict(run.status ?? 1);

    console.log(`[studio-e2e-bite] ${verdict.message}`);
    process.exitCode = verdict.bites ? 0 : 1;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', old], { cwd: root, stdio: 'ignore' });
    rmSync(scratch, { recursive: true, force: true });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
