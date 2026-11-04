import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AREAS = {
  cli: 'libs/cli',
  frontend: 'apps/ethlete-studio/src',
  host: 'apps/ethlete-studio/src-tauri',
};

const CACHE = 'tmp/studio-cli';

export const APP_CACHE = 'tmp/studio-app';

const git = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });

  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);

  return result.stdout.trim();
};

export const lastCommitOf = (root, path) => git(root, ['log', '-1', '--format=%H', '--', path]) || null;

export const isDirty = (root, path) => git(root, ['status', '--porcelain', '--', path]) !== '';

export const areaState = (root) => ({
  cli: { latest: lastCommitOf(root, AREAS.cli), dirty: isDirty(root, AREAS.cli) },
  frontend: { latest: lastCommitOf(root, AREAS.frontend) },
  host: { latest: lastCommitOf(root, AREAS.host) },
});

/**
 * Picks the committed build to run. A dirty `libs/cli` never yields a copy of the working build;
 * the last commit that touched the CLI is built when no copy of it exists yet.
 */
export const cliCopyPlan = ({ latest, dirty, copies, distMatches }) => {
  if (copies.includes(latest)) return { action: 'use', sha: latest };

  return { action: distMatches && !dirty ? 'copy' : 'build', sha: latest };
};

const sourceHashOf = (root) => {
  const module = join(root, 'dist/libs/cli/src/lib/source-hash.js');

  if (!existsSync(module)) return null;

  return createRequire(import.meta.url)(module).cliSourceHash(join(root, AREAS.cli));
};

const recordedHashOf = (buildDir) => {
  try {
    return JSON.parse(readFileSync(join(buildDir, 'build-info.json'), 'utf8')).sourceHash ?? null;
  } catch {
    return null;
  }
};

const copiesOf = (cache) =>
  existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => /^[0-9a-f]{40}$/.test(name) && existsSync(join(cache, name, PINNED_FILE)))
        .sort((a, b) => statSync(join(cache, a)).mtimeMs - statSync(join(cache, b)).mtimeMs)
    : [];

export const PINNED_FILE = 'pinned-commit';

const settle = (staging, target, sha) => {
  writeFileSync(join(staging, PINNED_FILE), `${sha}\n`);

  try {
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });

    if (!existsSync(target)) throw error;
  }
};

const nxBuild = (label, args) => (root, tree, log) => {
  symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'), 'dir');

  const build = spawnSync('npx', ['nx', 'build', ...args], {
    cwd: tree,
    encoding: 'utf8',
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
  });

  log(`${build.stdout}${build.stderr}`.trim());

  if (build.status !== 0) throw new Error(`Building ${label} failed.`);
};

const buildWithNx = nxBuild('the CLI', ['cli']);

const buildAppWithNx = nxBuild('the Studio app', ['ethlete-studio', '--configuration=development']);

const buildInWorktree = (root, sha, target, log, build, { label = 'the CLI', output = 'dist/libs/cli' } = {}) => {
  const scratch = mkdtempSync(join(tmpdir(), 'studio-code-'));
  const tree = join(scratch, 'tree');

  log(`Building ${label} at ${sha.slice(0, 7)} in a temporary worktree…`);
  git(root, ['worktree', 'add', '--detach', tree, sha]);

  try {
    build(root, tree, log);

    const staging = `${target}.partial-${process.pid}`;

    cpSync(join(tree, output), staging, { recursive: true });
    settle(staging, target, sha);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', tree], { cwd: root });
    rmSync(scratch, { recursive: true, force: true });
  }
};

const copyDist = (root, target, sha) => {
  const expected = sourceHashOf(root);
  const staging = `${target}.partial-${process.pid}`;

  cpSync(join(root, 'dist/libs/cli'), staging, { recursive: true });

  if (!expected || recordedHashOf(staging) !== expected) {
    rmSync(staging, { recursive: true, force: true });

    return false;
  }

  settle(staging, target, sha);

  return true;
};

export const ensureCliCopy = (
  root,
  { keepWhenDirty = true, log = (line) => console.error(line), build = buildWithNx } = {},
) => {
  const cache = join(root, CACHE);
  const currentFile = join(cache, 'current');
  const { latest, dirty } = areaState(root).cli;
  mkdirSync(cache, { recursive: true });

  const copies = copiesOf(cache);
  const expected = dirty ? null : sourceHashOf(root);
  const distMatches = expected !== null && recordedHashOf(join(root, 'dist/libs/cli')) === expected;
  const plan = cliCopyPlan({ latest, dirty, copies, distMatches });
  const target = join(cache, plan.sha);

  if (plan.action !== 'use') rmSync(target, { recursive: true, force: true });
  if (plan.action === 'copy' && !copyDist(root, target, plan.sha)) buildInWorktree(root, plan.sha, target, log, build);
  if (plan.action === 'build') buildInWorktree(root, plan.sha, target, log, build);

  if (keepWhenDirty) writeFileSync(currentFile, `${plan.sha}\n`);

  return { entry: join(target, 'src/index.js'), sha: plan.sha, dirty };
};

export const currentAppCopy = (root) => {
  try {
    return readFileSync(join(root, APP_CACHE, 'current'), 'utf8').trim() || null;
  } catch {
    return null;
  }
};

/**
 * Builds the last commit that touched the Studio frontend into `tmp/studio-app/<sha>` and points
 * `tmp/studio-app/current` at it. Uncommitted frontend edits never reach the copy.
 */
export const ensureAppCopy = (root, { log = (line) => console.error(line), build = buildAppWithNx } = {}) => {
  const cache = join(root, APP_CACHE);
  const sha = lastCommitOf(root, AREAS.frontend);

  if (!sha) throw new Error(`${AREAS.frontend} has no commit to build.`);

  mkdirSync(cache, { recursive: true });

  const target = join(cache, sha);
  const previous = currentAppCopy(root);

  if (!copiesOf(cache).includes(sha)) {
    rmSync(target, { recursive: true, force: true });
    buildInWorktree(root, sha, target, log, build, {
      label: 'the Studio app',
      output: 'dist/apps/ethlete-studio/browser',
    });
  }

  writeFileSync(join(cache, 'current'), `${sha}\n`);

  return { dir: target, sha, switched: previous !== null && previous !== sha };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const [command] = process.argv.slice(2);

  if (command === 'state') {
    console.log(JSON.stringify(areaState(root)));
  } else if (command === 'cli-copy') {
    console.log(JSON.stringify(ensureCliCopy(root)));
  } else if (command === 'app-copy') {
    console.log(JSON.stringify(ensureAppCopy(root)));
  } else {
    console.error('usage: studio-code.mjs <state|cli-copy|app-copy>');
    process.exit(2);
  }
}
