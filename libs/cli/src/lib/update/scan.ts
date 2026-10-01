import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Migration } from './migration-manifest';
import { PackageManager, nxCommand, spawnPackageManager } from './package-manager';
import { generatorArgs, hasNx } from './run-migrations';

export const SCAN_FILE_ENV = 'ETHLETE_SCAN_FILE';

export type ScanResult = { files: string[] } | { problem: string };

const readScanFile = (path: string): ScanResult => {
  if (!existsSync(path)) return { problem: 'the scan wrote no result' };

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { problem: 'the scan result is not valid JSON' };
  }

  if (!Array.isArray(parsed) || parsed.some((file) => typeof file !== 'string')) {
    return { problem: 'the scan result is not a list of paths' };
  }

  return { files: [...new Set(parsed as string[])] };
};

/** Runs the scan generator of a migration and returns the files it would touch, or why it could not tell. */
export const runScan = (options: { root: string; manager: PackageManager; migration: Migration }): ScanResult => {
  const { root, manager, migration } = options;

  if (!migration.scan) return { problem: 'the migration has no scan' };

  if (!hasNx(root)) return { problem: 'this repo has no Nx to run the scan with' };

  const [binary, ...args] = nxCommand({
    manager,
    args: generatorArgs({ migration: { ...migration, generator: migration.scan }, dryRun: true }),
  });

  if (binary === undefined) return { problem: 'no command to run the scan with' };

  const directory = mkdtempSync(join(tmpdir(), 'ethlete-scan-'));
  const resultPath = join(directory, 'files.json');

  try {
    const result = spawnPackageManager({
      binary,
      args,
      spawn: { cwd: root, stdio: 'ignore', env: { ...process.env, [SCAN_FILE_ENV]: resultPath } },
    });

    if (result.error) return { problem: result.error.message };

    if (result.status !== 0) return { problem: `${binary} exited with ${result.status}` };

    return readScanFile(resultPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};
