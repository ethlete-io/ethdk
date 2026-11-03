import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { specsForFiles } from './cli-related-map.mjs';
import { linkNodeModules } from './link-node-modules.mjs';

const git = (root, args, env = process.env) => {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
};

// A path-limited commit sets GIT_INDEX_FILE to a temporary index; specs that run git in their own repos must not inherit it.
const withoutGitEnv = () => {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return env;
};

export const suitesForFiles = (files, relatedMap) => {
  const cli = [
    ...files.filter((file) => file.startsWith('libs/cli/')),
    ...specsForFiles(files, relatedMap).map((spec) => `libs/cli/${spec}`),
  ];
  const studio = files.filter((file) => file.startsWith('apps/ethlete-studio/'));

  return [
    studio.length && {
      name: 'Studio',
      cwd: '.',
      args: ['--reporter=default', '--config', 'apps/ethlete-studio/vite.config.mts'],
      files: studio,
    },
    cli.length && { name: 'cli', cwd: 'libs/cli', args: [], files: cli },
  ].filter(Boolean);
};

const DOCS_ONLY = /^(plans\/|apps\/docs\/|\.changeset\/)|\.md$/;

export const isDocsOnly = (files) => files.every((file) => DOCS_ONLY.test(file));

export const timedOutSpecs = (output) => {
  const failures = output.match(/^\s*(?:Error|AssertionError|TypeError)\b.*$/gm) ?? [];
  const specs = [...output.matchAll(/^\s*FAIL\s+(?:\|[^|\s]+\|\s+)?(\S+\.spec\.\w+)/gm)].map((match) => match[1]);
  const onlyTimeouts = failures.length > 0 && failures.every((line) => /timed out in \d+ms/.test(line));
  return onlyTimeouts ? [...new Set(specs)] : [];
};

const runVitest = (cwd, args) => {
  const result = spawnSync('npx', ['vitest', ...args], {
    cwd,
    env: withoutGitEnv(),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: Number(process.env.PRECOMMIT_SPECS_TIMEOUT_MS ?? 20 * 60 * 1000),
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

const relatedMapAt = (root, rev) => {
  const map = spawnSync('git', ['show', `${rev}:libs/cli/related-map.json`], { cwd: root, encoding: 'utf8' });
  return map.status === 0 ? JSON.parse(map.stdout) : {};
};

const runSuites = (checkout, suites) => {
  for (const suite of suites) {
    const run = runVitest(join(checkout, suite.cwd), [
      'related',
      '--run',
      '--passWithNoTests',
      ...suite.args,
      ...suite.files.map((file) => join(checkout, file)),
    ]);
    let status = run.status;
    const slow = status === 0 ? [] : timedOutSpecs(run.output);

    if (slow.length) {
      console.error(`pre-commit: ${slow.join(', ')} failed only by timeout; re-running alone once.`);
      status = runVitest(join(checkout, suite.cwd), ['run', ...suite.args, ...slow]).status;
    }

    if (status !== 0) {
      console.error(`pre-commit: a ${suite.name} spec related to the staged files fails (FAIL lines above name it).`);
      return 1;
    }
  }
  return 0;
};

export const TESTED_TREE_ENV = 'PRECOMMIT_SPECS_TREE';

const treeOfIndex = (root, index) => {
  const copy = join(mkdtempSync(join(tmpdir(), 'pre-commit-index-')), 'index');
  try {
    if (index) copyFileSync(index, copy);
    return { copy, tree: (env) => git(root, ['write-tree'], { ...env, GIT_INDEX_FILE: copy }).trim() };
  } catch (error) {
    rmSync(dirname(copy), { recursive: true, force: true });
    throw error;
  }
};

export const treeOfPaths = (root, paths) => {
  const env = withoutGitEnv();
  const { copy, tree } = treeOfIndex(root, null);
  try {
    git(root, ['read-tree', 'HEAD'], { ...env, GIT_INDEX_FILE: copy });
    git(root, ['add', '-A', '--', ...paths], { ...env, GIT_INDEX_FILE: copy });
    return tree(env);
  } finally {
    rmSync(dirname(copy), { recursive: true, force: true });
  }
};

const stagedTree = (root) => {
  const index =
    process.env.GIT_INDEX_FILE ?? git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
  const { copy, tree } = treeOfIndex(root, index);
  try {
    return tree(withoutGitEnv());
  } finally {
    rmSync(dirname(copy), { recursive: true, force: true });
  }
};

const removeWorktree = (root, worktree) => {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, env: withoutGitEnv() });
  rmSync(worktree, { recursive: true, force: true });
  spawnSync('git', ['worktree', 'prune'], { cwd: root, env: withoutGitEnv() });
};

export const runPathSpecs = (root, paths) => {
  const tree = treeOfPaths(root, paths);
  const changes = git(root, ['diff', '--name-status', '--no-renames', '-z', 'HEAD', tree], withoutGitEnv())
    .split('\0')
    .filter(Boolean)
    .reduce(
      (pairs, entry, index, all) => (index % 2 ? pairs : [...pairs, { status: entry, file: all[index + 1] }]),
      [],
    );
  const files = changes.filter((change) => change.status !== 'D').map((change) => change.file);
  if (!files.length || isDocsOnly(files)) return { status: 0, tree };
  const suites = suitesForFiles(files, relatedMapAt(root, tree));
  if (!suites.length) return { status: 0, tree };

  const worktree = join(mkdtempSync(join(tmpdir(), 'yarn-commit-')), 'tree');
  const cleanup = () => removeWorktree(root, worktree);
  const onSignal = (signal) => {
    cleanup();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach((signal) => process.once(signal, onSignal));

  try {
    git(
      root,
      ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', '--quiet', worktree, 'HEAD'],
      withoutGitEnv(),
    );
    for (const { status, file } of changes) {
      rmSync(join(worktree, file), { recursive: true, force: true });
      if (status === 'D') continue;
      mkdirSync(dirname(join(worktree, file)), { recursive: true });
      cpSync(join(root, file), join(worktree, file), { verbatimSymlinks: true });
    }
    linkNodeModules(root, worktree);
    return { status: runSuites(worktree, suites), tree };
  } finally {
    signals.forEach((signal) => process.off(signal, onSignal));
    cleanup();
    rmSync(dirname(worktree), { recursive: true, force: true });
  }
};

export const runStagedSpecs = (root) => {
  const tested = process.env[TESTED_TREE_ENV];
  if (tested && tested === stagedTree(root)) {
    console.error('pre-commit: specs already ran for this exact tree in yarn commit; skipping them.');
    return 0;
  }

  const files = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z']).split('\0').filter(Boolean);
  if (!files.length || isDocsOnly(files)) return 0;
  const suites = suitesForFiles(files, relatedMapAt(root, ''));
  if (!suites.length) return 0;

  const checkout = mkdtempSync(join(tmpdir(), 'pre-commit-'));

  try {
    git(root, ['checkout-index', '--all', `--prefix=${checkout}/`]);
    linkNodeModules(root, checkout);
    return runSuites(checkout, suites);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runStagedSpecs(process.cwd()));
}
