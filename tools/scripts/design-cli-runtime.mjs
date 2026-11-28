#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompleteBuild } from '../../libs/cli-core/scripts/move-into-place.mts';
import { swapIntoPlace } from '../../libs/cli-core/scripts/package-layout.mts';
import { writeBuildInfo } from '../../libs/cli-core/scripts/write-build-info.mts';
import { compileDesign, DESIGN_ROOT, readJson } from '../../libs/design/scripts/build.mts';

/** The design entry inside the runtime, as `SHIPPED_CLI` in apps/ethlete-studio/src-tauri/src/design_server.rs names it. */
export const RUNTIME_ENTRY = 'src/bin.js';

/**
 * The runtime's manifest. `playwright` is left out: it wants a browser download of its own, so the browser stage of
 * `et design check` and the server's variant thumbnails take it from the checkout. Every other dependency is the one
 * libs/design declares.
 */
export const runtimeManifestOf = ({ designManifest, studioManifest }) => ({
  name: 'ethlete-studio-design-runtime',
  version: studioManifest.version,
  private: true,
  dependencies: designManifest.dependencies,
});

const build = (root) => {
  const runtime = resolve(root, 'dist/apps/ethlete-studio/cli-runtime');
  const run = `${runtime}-run-${process.pid}`;

  rmSync(run, { recursive: true, force: true });

  try {
    compileDesign(root, run, runtime);

    const manifest = runtimeManifestOf({
      designManifest: readJson(resolve(root, DESIGN_ROOT, 'package.json')),
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
    writeBuildInfo(run, resolve(root, DESIGN_ROOT), 'design');
    swapIntoPlace(run, runtime);
  } finally {
    rmSync(run, { recursive: true, force: true });
  }

  if (!existsSync(join(runtime, RUNTIME_ENTRY))) throw new Error(`${runtime} has no ${RUNTIME_ENTRY}`);

  console.log(`design runtime written to ${runtime}`);
};

if (import.meta.main) build(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
