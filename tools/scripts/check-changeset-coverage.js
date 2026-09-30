/**
 * Fails when a commit in `NX_BASE..NX_HEAD` changes a versioned workspace package, private ones
 * included, and no changeset in that range names the package. A change that needs no release
 * names the package with the level `none`.
 *
 * Only first-parent, non-merge commits count: a merge brings in commits another range already
 * checked. Commits by the release bot are skipped.
 *
 * Usage:
 *   NX_BASE=<sha> [NX_HEAD=<sha>] node tools/scripts/check-changeset-coverage.js
 */

const { execFileSync } = require('child_process');
const { readFileSync, readdirSync, existsSync } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '../..');
const RELEASE_BOT = 'github-actions[bot]';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const packageDirs = () => {
  const { workspaces } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const dirs = workspaces.flatMap((pattern) =>
    pattern.endsWith('/*')
      ? readdirSync(join(ROOT, pattern.slice(0, -2)), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${pattern.slice(0, -2)}/${entry.name}`)
      : [pattern],
  );

  return dirs
    .filter((dir) => existsSync(join(ROOT, dir, 'package.json')))
    .map((dir) => ({ dir: `${dir}/`, name: JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')).name }))
    .filter(({ name }) => name.startsWith('@ethlete/') || name === 'timetrack-app' || name === 'ethlete-studio');
};

const changesetPackages = (sha, path) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n?---/.exec(git('show', `${sha}:${path}`));

  return (match?.[1] ?? '')
    .split(/\r?\n/)
    .map((line) => /^\s*['"]?([^'":]+)['"]?\s*:/.exec(line)?.[1])
    .filter(Boolean);
};

const base = process.env.NX_BASE;
const head = process.env.NX_HEAD || 'HEAD';

if (!base) {
  console.log('Changeset coverage skipped: NX_BASE is not set.');
  process.exit(0);
}

const dirs = packageDirs();
const commits = git('log', '--first-parent', '--no-merges', '--format=%H%x09%an%x09%s', `${base}..${head}`)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .filter(([, author]) => author !== RELEASE_BOT);

const covered = new Set();
const touchedBy = new Map();

for (const [sha, , subject] of commits) {
  const changes = git('diff-tree', '--no-commit-id', '--name-status', '-r', sha)
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));

  for (const [status, path] of changes) {
    if (status === 'D' || !/^\.changeset\/[^/]+\.md$/.test(path) || path === '.changeset/README.md') continue;

    for (const name of changesetPackages(sha, path)) covered.add(name);
  }

  const touched = new Set(
    changes.flatMap(([, ...paths]) =>
      paths.flatMap((path) => dirs.filter(({ dir }) => path.startsWith(dir)).map(({ name }) => name)),
    ),
  );

  for (const name of touched) {
    if (!touchedBy.has(name)) touchedBy.set(name, []);
    touchedBy.get(name).push(`${sha.slice(0, 9)} ${subject}`);
  }
}

const missing = [...touchedBy].filter(([name]) => !covered.has(name));

if (missing.length === 0) {
  console.log(`✔ Every package changed in ${base.slice(0, 9)}..${head} has a changeset.`);
  process.exit(0);
}

for (const [name, subjects] of missing) {
  console.error(`\n✖ ${name} changed, but no changeset in the range names it:`);
  for (const subject of subjects) console.error(`  - ${subject}`);
}

console.error(
  '\nAdd a changeset for each package (see the `changeset` skill), private packages too. If the change\n' +
    "needs no release, for example a test or a story, name the package with the level `none`: '<pkg>': none\n",
);
process.exit(1);
