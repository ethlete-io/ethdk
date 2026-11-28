import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompleteBuild } from '../../cli-core/scripts/move-into-place.mts';
import { layOutPackage, swapIntoPlace } from '../../cli-core/scripts/package-layout.mts';
import { writeBuildInfo } from '../../cli-core/scripts/write-build-info.mts';

/** The design entry of a build, run as `node <build>/src/bin.js design …`. */
export const DESIGN_ENTRY = 'src/bin.js';

export const DESIGN_ROOT = 'libs/design';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

/** Compiles libs/design and the libs/cli-core it imports into `run`, laid out for the place it is moved to (`final`). */
export const compileDesign = (root: string, run: string, final = run) => {
  const emitted = `${run}-tsc`;

  rmSync(emitted, { recursive: true, force: true });

  try {
    const tsc = spawnSync('npx', ['tsc', '-p', join(DESIGN_ROOT, 'tsconfig.build.json'), '--outDir', emitted], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (tsc.status !== 0) throw new Error(`tsc exited with ${tsc.status}`);

    layOutPackage(emitted, run, final);
    cpSync(resolve(root, DESIGN_ROOT, 'design'), join(run, 'design'), {
      recursive: true,
      filter: (source) => !(statSync(source).isFile() && source.endsWith(`${sep}tsconfig.json`)),
    });
  } finally {
    rmSync(emitted, { recursive: true, force: true });
  }
};

/**
 * Builds the design tool into `target` for this repository's own tooling. The build resolves its
 * dependencies from the repository's `node_modules`.
 */
export const buildDesign = (root: string, target: string) => {
  const output = resolve(root, target);
  const run = `${output}-run-${process.pid}`;

  rmSync(run, { recursive: true, force: true });

  try {
    compileDesign(root, run, output);
    writeFileSync(
      join(run, 'package.json'),
      `${JSON.stringify({ ...readJson(resolve(root, DESIGN_ROOT, 'package.json')), main: `./${DESIGN_ENTRY}` }, null, 2)}\n`,
    );
    assertCompleteBuild(run, run, DESIGN_ENTRY);
    writeBuildInfo(run, resolve(root, DESIGN_ROOT), 'design');
    swapIntoPlace(run, output);
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  try {
    buildDesign(repoRoot, process.argv[2] ?? 'dist/libs/design');
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
