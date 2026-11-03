import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { specsForFiles } from './cli-related-map.mjs';

const git = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

const linkNodeModules = (root, checkout) => {
  const source = join(root, 'node_modules');
  if (!existsSync(source)) return;

  const target = join(checkout, 'node_modules');
  mkdirSync(target);

  for (const name of readdirSync(source)) {
    const entry = join(source, name);
    if (lstatSync(entry).isSymbolicLink()) {
      symlinkSync(readlinkSync(entry), join(target, name));
    } else if (name === '@ethlete') {
      mkdirSync(join(target, name));
      for (const scoped of readdirSync(entry)) {
        symlinkSync(readlinkSync(join(entry, scoped)), join(target, name, scoped));
      }
    } else {
      symlinkSync(entry, join(target, name));
    }
  }

  for (const top of ['libs', 'apps', 'tools']) {
    if (!existsSync(join(root, top))) continue;
    for (const project of readdirSync(join(root, top))) {
      const nested = join(top, project, 'node_modules');
      if (
        existsSync(join(root, nested)) &&
        existsSync(dirname(join(checkout, nested))) &&
        !existsSync(join(checkout, nested))
      ) {
        symlinkSync(join(root, nested), join(checkout, nested));
      }
    }
  }
};

const stagedRelatedMap = (root) => {
  const map = spawnSync('git', ['show', ':libs/cli/related-map.json'], { cwd: root, encoding: 'utf8' });
  return map.status === 0 ? JSON.parse(map.stdout) : {};
};

export const runStagedSpecs = (root) => {
  const files = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z']).split('\0').filter(Boolean);
  const suites = suitesForFiles(files, stagedRelatedMap(root));
  if (!suites.length) return 0;

  const checkout = mkdtempSync(join(tmpdir(), 'pre-commit-'));

  try {
    git(root, ['checkout-index', '--all', `--prefix=${checkout}/`]);
    linkNodeModules(root, checkout);

    for (const suite of suites) {
      const status = spawnSync(
        'npx',
        [
          'vitest',
          'related',
          '--run',
          '--passWithNoTests',
          ...suite.args,
          ...suite.files.map((file) => join(checkout, file)),
        ],
        { cwd: join(checkout, suite.cwd), env: withoutGitEnv(), stdio: 'inherit' },
      ).status;

      if (status !== 0) {
        console.error(`pre-commit: a ${suite.name} spec related to the staged files fails (FAIL lines above name it).`);
        return 1;
      }
    }
    return 0;
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runStagedSpecs(process.cwd()));
}
