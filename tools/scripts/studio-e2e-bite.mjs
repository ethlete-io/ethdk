#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DRAWING_BUILDS, exportCommit, revertInExport } from './commit-export.mjs';

const root = resolve(import.meta.dirname, '../..');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';

const USAGE = 'usage: studio-e2e-bite.mjs <git-ref-before-the-fix> [e2e args] | --revert <fix-sha> [e2e args]';

export const parseBiteArgs = (argv) => {
  if (argv[0] === '--revert') {
    const [, revert, ...rest] = argv;
    if (!revert || revert.startsWith('--')) return { error: USAGE };
    return { revert, e2eArgs: rest };
  }
  const [ref, ...rest] = argv;
  if (!ref || ref.startsWith('--')) return { error: USAGE };

  return { ref, e2eArgs: rest };
};

export const biteVerdict = (status, subject = 'the old CLI') =>
  status === 0
    ? { bites: false, message: `the e2e passes on ${subject}: the new case does not bite` }
    : { bites: true, message: `the e2e fails on ${subject}: the new case bites` };

const report = (verdict) => {
  console.log(`[studio-e2e-bite] ${verdict.message}`);
  process.exitCode = verdict.bites ? 0 : 1;
};

const fail = (message) => {
  console.error(`[studio-e2e-bite] ${message}`);
  process.exitCode = 2;
};

const revertMain = ({ revert, e2eArgs }) => {
  const commitOf = (rev) =>
    spawnSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], { cwd: root, encoding: 'utf8' });
  const [head, fix] = [commitOf('HEAD'), commitOf(revert)];
  if (head.status !== 0 || fix.status !== 0) return fail(`cannot resolve ${revert}: ${fix.stderr.trim()}`);

  const env = { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' };
  delete env['STUDIO_CLI_ENTRY'];
  const { dir, error } = exportCommit(root, head.stdout.trim(), 'studio-e2e-bite');
  try {
    if (error) return fail(`the export of HEAD failed: ${error}`);
    const reverted = revertInExport(root, fix.stdout.trim(), dir);
    if (reverted.error) return fail(reverted.error);

    const build = spawnSync('npx', ['nx', 'run-many', '-t', 'build', '-p', ...DRAWING_BUILDS], {
      cwd: dir,
      stdio: 'inherit',
      env,
    });
    if (build.status !== 0) return fail('the build in the export failed');

    const run = spawnSync(process.execPath, [join(dir, RUNNER), ...e2eArgs], { cwd: dir, stdio: 'inherit', env });
    report(biteVerdict(run.status ?? 1, `HEAD with ${revert} reverted`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const main = () => {
  const parsed = parseBiteArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(2);
  }
  if (parsed.revert) return revertMain(parsed);

  const scratch = mkdtempSync(join(tmpdir(), 'studio-e2e-bite-'));
  const old = join(scratch, 'old');
  const env = { ...process.env, NX_NO_CLOUD: 'true' };

  try {
    execFileSync('git', ['worktree', 'add', '--detach', old, parsed.ref], { cwd: root, stdio: 'inherit' });
    if (!existsSync(join(old, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(old, 'node_modules'));
    execFileSync('npx', ['nx', 'build', 'cli', '--skip-nx-cache'], { cwd: old, stdio: 'inherit', env });

    const entry = join(old, 'dist/libs/cli/src/index.js');
    const run = spawnSync(process.execPath, [join(root, RUNNER), ...parsed.e2eArgs], {
      cwd: root,
      stdio: 'inherit',
      env: { ...env, STUDIO_CLI_ENTRY: entry },
    });
    report(biteVerdict(run.status ?? 1));
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', old], { cwd: root, stdio: 'ignore' });
    rmSync(scratch, { recursive: true, force: true });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
