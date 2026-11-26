import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = (args, { cwd, indexFile, env = process.env } = {}) =>
  spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: indexFile ? { ...env, GIT_INDEX_FILE: indexFile } : env,
  });

const patchedPaths = (cwd, patch, env) =>
  run(['apply', '--unidiff-zero', '--numstat', '-z', patch], { cwd, env })
    .stdout.split('\0')
    .map((entry) => entry.split('\t').pop())
    .filter(Boolean);

/**
 * Commits one patch on top of HEAD through a temporary index, so the shared index and the working tree are never touched.
 * Hooks run as for a normal commit. Returns the exit code.
 */
export const commitPatch = (patch, message, cwd = process.cwd(), env = process.env) => {
  const patchFile = resolve(patch);
  const paths = patchedPaths(cwd, patchFile, env);
  const dir = mkdtempSync(join(tmpdir(), 'commit-patch-'));
  const indexFile = join(dir, 'index');

  try {
    const alreadyStaged = run(['diff', '--cached', '--quiet', '--', ...paths], { cwd, env }).status !== 0;
    for (const args of [
      ['read-tree', 'HEAD'],
      ['apply', '--unidiff-zero', '--cached', patchFile],
      ['commit', '-m', message],
    ]) {
      const result = run(args, { cwd, indexFile, env });
      if (result.status !== 0) {
        return result.status ?? 1;
      }
    }
    if (!alreadyStaged) {
      run(['reset', '-q', '--', ...paths], { cwd, env });
    }
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = args.indexOf('-m');
  const patch = args.find((arg, index) => index !== flag && index !== flag + 1);
  if (!patch || flag < 0 || !args[flag + 1]) {
    console.error('usage: commit-patch.mjs <patch> -m <message>');
    process.exit(2);
  }
  process.exit(commitPatch(patch, args[flag + 1]));
}
