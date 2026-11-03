import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

export const suitesForFiles = (files, relatedMap, toolSpecGlobs = []) => {
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
    ...toolSpecGlobs.map((glob) => {
      const owned = files.filter((file) => file.startsWith(`${dirname(glob)}/`));
      return owned.length && { name: dirname(glob), cwd: '.', node: glob, files: owned };
    }),
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

/** The spec globs `yarn test:tools` passes to `node --test`, read from package.json at `rev`. */
export const toolSpecGlobsAt = (root, rev) => {
  const manifest = spawnSync('git', ['show', `${rev}:package.json`], { cwd: root, encoding: 'utf8' });
  if (manifest.status !== 0) return [];
  const script = JSON.parse(manifest.stdout).scripts?.['test:tools'] ?? '';
  return script.split(/\s+/).filter((arg) => /\.spec\.m?js$/.test(arg));
};

const relatedMapAt = (root, rev) => {
  const map = spawnSync('git', ['show', `${rev}:libs/cli/related-map.json`], { cwd: root, encoding: 'utf8' });
  return map.status === 0 ? JSON.parse(map.stdout) : {};
};

const selectsNoSpecs = (root, files, rev) =>
  !files.length ||
  isDocsOnly(files) ||
  !suitesForFiles(files, relatedMapAt(root, rev), toolSpecGlobsAt(root, rev)).length;

const runNodeTests = (checkout, glob) => {
  const name = new RegExp(`^${basename(glob).replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
  const specs = readdirSync(join(checkout, dirname(glob)))
    .filter((file) => name.test(file))
    .map((file) => join(dirname(glob), file));
  if (!specs.length) return 0;
  const env = withoutGitEnv();
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync('node', ['--test', ...specs], {
    cwd: checkout,
    env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: Number(process.env.PRECOMMIT_SPECS_TIMEOUT_MS ?? 20 * 60 * 1000),
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return result.status;
};

const runSuites = (checkout, suites) => {
  for (const suite of suites) {
    if (suite.node) {
      if (runNodeTests(checkout, suite.node) !== 0) {
        console.error(`pre-commit: a ${suite.name} spec fails (the ✖ lines above name it).`);
        return 1;
      }
      continue;
    }
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

/** The `tsconfig.lib.json` and `tsconfig.spec.json` of each `libs/<name>` that `files` touch, as repo-relative paths. */
export const typeProjectsForFiles = (root, files) =>
  [...new Set(files.map((file) => file.match(/^libs\/[^/]+\//)?.[0]).filter(Boolean))].flatMap((lib) =>
    ['tsconfig.lib.json', 'tsconfig.spec.json']
      .map((name) => `${lib}${name}`)
      .filter((project) => existsSync(join(root, project))),
  );

/** Error lines of a `tsc` run; any of them blocks the commit. */
export const blockingTypeErrors = (output) => output.split('\n').filter((line) => / error TS\d+:/.test(line));

const runTypeChecks = (checkout, projects) => {
  for (const project of projects) {
    const run = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false', '-p', project], {
      cwd: checkout,
      env: withoutGitEnv(),
      encoding: 'utf8',
    });
    const errors = blockingTypeErrors(run.stdout + run.stderr);
    if (errors.length) {
      console.error(errors.join('\n'));
      console.error(
        `pre-commit: ${project} has type errors (above); vitest does not type-check, so the commit stops here.`,
      );
      return 1;
    }
  }
  return 0;
};

const owningProject = (root, file) => {
  for (let dir = dirname(file); dir !== '.'; dir = dirname(dir)) {
    const config = join(root, dir, 'project.json');
    if (!existsSync(config)) continue;
    const project = JSON.parse(readFileSync(config, 'utf8'));
    const lints = Boolean(project.targets?.lint) || existsSync(join(root, dir, 'eslint.config.mjs'));
    return lints ? project.name : null;
  }
  return null;
};

/** The nx projects owning `files` that have a lint target, by name. */
export const lintProjectsForFiles = (root, files) => [
  ...new Set(
    files
      .filter((file) => !DOCS_ONLY.test(file))
      .map((file) => owningProject(root, file))
      .filter(Boolean),
  ),
];

const runLint = (root, checkout, projects) => {
  if (!projects.length) return 0;
  const run = spawnSync('npx', ['nx', 'run-many', '-t', 'lint', '-p', projects.join(','), '--outputStyle=static'], {
    cwd: checkout,
    env: {
      ...withoutGitEnv(),
      NX_NO_CLOUD: 'true',
      NX_DAEMON: 'false',
      NX_CACHE_DIRECTORY: join(root, '.nx', 'cache'),
    },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (run.status === 0) return 0;
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  console.error(`pre-commit: lint fails in ${projects.join(', ')} (above); run \`npx nx lint <project> --fix\`.`);
  return 1;
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
  const projects = typeProjectsForFiles(root, files);
  const linted = lintProjectsForFiles(root, files);
  const noSpecs = selectsNoSpecs(root, files, tree);
  if (noSpecs && projects.length === 0 && linted.length === 0) return { status: 0, tree };
  const suites = noSpecs ? [] : suitesForFiles(files, relatedMapAt(root, tree), toolSpecGlobsAt(root, tree));

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
    const status = runTypeChecks(worktree, projects) || runLint(root, worktree, linted) || runSuites(worktree, suites);
    return { status, tree };
  } finally {
    signals.forEach((signal) => process.off(signal, onSignal));
    cleanup();
    rmSync(dirname(worktree), { recursive: true, force: true });
  }
};

const changedSinceTested = (root, tested, staged) => {
  const diff = spawnSync('git', ['diff-tree', '-r', '--name-only', '--no-renames', '-z', tested, staged], {
    cwd: root,
    env: withoutGitEnv(),
    encoding: 'utf8',
  });
  return diff.status === 0 ? diff.stdout.split('\0').filter(Boolean) : null;
};

const alreadyTested = (root) => {
  const tested = process.env[TESTED_TREE_ENV];
  if (!tested) return false;
  const staged = stagedTree(root);
  if (tested === staged) {
    console.error('pre-commit: specs already ran for this exact tree in yarn commit; skipping them.');
    return true;
  }
  const changed = changedSinceTested(root, tested, staged);
  if (!changed || !selectsNoSpecs(root, changed, staged) || lintProjectsForFiles(root, changed).length) return false;
  console.error(
    `pre-commit: specs already ran in yarn commit; the ${changed.length} files committed since select no specs; skipping them.`,
  );
  return true;
};

export const runStagedSpecs = (root) => {
  if (alreadyTested(root)) return 0;

  const files = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z']).split('\0').filter(Boolean);
  const linted = lintProjectsForFiles(root, files);
  const noSpecs = selectsNoSpecs(root, files, '');
  if (noSpecs && !linted.length) return 0;
  const suites = noSpecs ? [] : suitesForFiles(files, relatedMapAt(root, ''), toolSpecGlobsAt(root, ''));

  const checkout = mkdtempSync(join(tmpdir(), 'pre-commit-'));

  try {
    git(root, ['checkout-index', '--all', `--prefix=${checkout}/`]);
    linkNodeModules(root, checkout);
    return runLint(root, checkout, linted) || runSuites(checkout, suites);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runStagedSpecs(process.cwd()));
}
