import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { assertCompleteBuild } from '../../cli-core/scripts/move-into-place.mts';
import { layOutPackage, swapIntoPlace } from '../../cli-core/scripts/package-layout.mts';

const copyAssets = (run: string) => {
  for (const name of readdirSync('libs/cli').filter((entry) => entry.endsWith('.md'))) {
    cpSync(join('libs/cli', name), join(run, name));
  }

  cpSync('libs/cli/playwright', join(run, 'playwright'), { recursive: true });
  cpSync('libs/design/design', join(run, 'design'), {
    recursive: true,
    filter: (source) => !(statSync(source).isFile() && source.endsWith(`${sep}tsconfig.json`)),
  });

  const manifest = JSON.parse(readFileSync('libs/cli/package.json', 'utf8')) as Record<string, unknown>;

  writeFileSync(join(run, 'package.json'), JSON.stringify({ ...manifest, types: './src/index.d.ts' }, null, 2));
};

if (import.meta.main) {
  const [target, final] = process.argv.slice(2);

  if (!target) throw new Error('usage: compile.mts <target> [<final place it is moved to>]');

  const output = resolve(target);
  const run = `${output}-run-${process.pid}`;
  const emitted = `${run}-tsc`;

  rmSync(run, { recursive: true, force: true });
  rmSync(emitted, { recursive: true, force: true });

  try {
    const result = spawnSync('npx', ['tsc', '-p', 'libs/cli/tsconfig.build.json', '--outDir', emitted], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (result.status !== 0) throw new Error(`tsc exited with ${result.status}`);

    layOutPackage(emitted, run, resolve(final ?? target));
    copyAssets(run);
    assertCompleteBuild(run, run);
    swapIntoPlace(run, output);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    rmSync(run, { recursive: true, force: true });
    rmSync(emitted, { recursive: true, force: true });
  }
}
