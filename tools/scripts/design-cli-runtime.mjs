#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layOutPackage, swapIntoPlace } from '../../libs/cli/scripts/compile.mts';
import { assertCompleteBuild } from '../../libs/cli/scripts/move-into-place.mts';

/** The design entry inside the runtime, as `SHIPPED_CLI` in apps/ethlete-studio/src-tauri/src/design_server.rs names it. */
export const RUNTIME_ENTRY = 'src/bin.js';

/**
 * The runtime's manifest. `playwright` is left out: it wants a browser download of its own, so the browser stage of
 * `et design check` and the server's variant thumbnails take it from the checkout. Every other dependency is the one
 * `@ethlete/cli` declares, so the shipped copy draws with the versions the published package draws with.
 */
export const runtimeManifestOf = ({ cliManifest, studioManifest }) => ({
  name: 'ethlete-studio-design-runtime',
  version: studioManifest.version,
  private: true,
  dependencies: cliManifest.dependencies,
});

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const build = (root) => {
  const runtime = resolve(root, 'dist/apps/ethlete-studio/cli-runtime');
  const run = `${runtime}-run-${process.pid}`;
  const emitted = `${run}-tsc`;

  rmSync(run, { recursive: true, force: true });
  rmSync(emitted, { recursive: true, force: true });

  try {
    const tsc = spawnSync('npx', ['tsc', '-p', 'libs/design/tsconfig.build.json', '--outDir', emitted], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (tsc.status !== 0) throw new Error(`tsc exited with ${tsc.status}`);

    layOutPackage(emitted, run, runtime);
    cpSync(resolve(root, 'libs/design/design'), join(run, 'design'), {
      recursive: true,
      filter: (source) => !(statSync(source).isFile() && source.endsWith(`${sep}tsconfig.json`)),
    });

    const manifest = runtimeManifestOf({
      cliManifest: readJson(resolve(root, 'libs/cli/package.json')),
      studioManifest: readJson(resolve(root, 'apps/ethlete-studio/package.json')),
    });

    writeFileSync(join(run, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    /**
     * `--omit=optional` would drop esbuild's platform binary, which vite cannot run without. The
     * install is therefore per platform, which is what a bundle is anyway.
     *
     * On Windows `npm` is `npm.cmd`, which Node spawns only through a shell.
     */
    execFileSync('npm', ['install', '--omit=dev', '--omit=peer', '--no-audit', '--no-fund', '--no-package-lock'], {
      cwd: run,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    assertCompleteBuild(run, run, RUNTIME_ENTRY);
    execFileSync(process.execPath, [resolve(root, 'libs/cli/scripts/write-build-info.mts'), run, 'libs/cli'], {
      cwd: root,
      stdio: 'inherit',
    });
    swapIntoPlace(run, runtime);
  } finally {
    rmSync(run, { recursive: true, force: true });
    rmSync(emitted, { recursive: true, force: true });
  }

  if (!existsSync(join(runtime, RUNTIME_ENTRY))) throw new Error(`${runtime} has no ${RUNTIME_ENTRY}`);

  console.log(`design runtime written to ${runtime}`);
};

if (import.meta.main) build(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
