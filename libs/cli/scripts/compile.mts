import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { assertCompleteBuild } from './move-into-place.mts';

/** Swaps `from` over `target` so a reader finds either the old or the new build, never a half-written one. */
export const swapIntoPlace = (from: string, target: string) => {
  const old = `${from}-old`;

  mkdirSync(dirname(target), { recursive: true });
  rmSync(old, { recursive: true, force: true });
  if (existsSync(target)) renameSync(target, old);
  renameSync(from, target);
  rmSync(old, { recursive: true, force: true });
};

if (import.meta.main) {
  const [target] = process.argv.slice(2);

  if (!target) throw new Error('usage: compile.mts <target>');

  const output = resolve(target);
  const run = `${output}-run-${process.pid}`;

  rmSync(run, { recursive: true, force: true });

  try {
    const result = spawnSync(
      'npx',
      ['nx', 'run', 'cli:compile-tsc', `--outputPath=${relative(process.cwd(), run)}`, '--skip-nx-cache'],
      {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );

    if (result.status !== 0) throw new Error(`cli:compile-tsc exited with ${result.status}`);

    assertCompleteBuild(run, run);
    swapIntoPlace(run, output);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
}
