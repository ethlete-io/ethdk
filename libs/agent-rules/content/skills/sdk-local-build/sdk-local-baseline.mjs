import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const baselinePaths = (baselineDir) => ({
  manifest: join(baselineDir, 'package.json.baseline'),
  lockfile: join(baselineDir, 'yarn.lock.baseline'),
});

export const captureBaseline = (manifestPath, lockfilePath, baselineDir) => {
  const baseline = baselinePaths(baselineDir);

  mkdirSync(baselineDir, { recursive: true });

  if (existsSync(baseline.manifest) || existsSync(baseline.lockfile)) {
    throw new Error(`Baseline already exists in ${baselineDir}.`);
  }

  copyFileSync(manifestPath, baseline.manifest);
  copyFileSync(lockfilePath, baseline.lockfile);
};

export const restoreBaseline = (manifestPath, lockfilePath, baselineDir) => {
  const baseline = baselinePaths(baselineDir);

  copyFileSync(baseline.manifest, manifestPath);
  copyFileSync(baseline.lockfile, lockfilePath);
};

export const verifyBaseline = (manifestPath, lockfilePath, baselineDir) => {
  const baseline = baselinePaths(baselineDir);

  for (const [current, recorded] of [
    [manifestPath, baseline.manifest],
    [lockfilePath, baseline.lockfile],
  ]) {
    if (!readFileSync(current).equals(readFileSync(recorded))) {
      throw new Error(`${current} does not match its recorded baseline.`);
    }
  }
};

const run = () => {
  const [mode, manifestPath, lockfilePath, baselineDir] = process.argv.slice(2);

  if (!mode || !manifestPath || !lockfilePath || !baselineDir) {
    throw new Error('Usage: sdk-local-baseline.mjs <capture|restore|verify> <manifest> <lockfile> <baseline-dir>');
  }

  const actions = {
    capture: captureBaseline,
    restore: restoreBaseline,
    verify: verifyBaseline,
  };
  const action = actions[mode];

  if (!action) throw new Error(`Unknown mode "${mode}".`);

  action(manifestPath, lockfilePath, baselineDir);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run();
}
