import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];
export const DRAWING_BUILDS = ['cli', 'components', 'core'];

export const linkTargetOf = (repo, entry, link) => {
  if (link === undefined || isAbsolute(link)) return entry;
  const target = relative(repo, resolve(dirname(entry), link)).split(sep);
  const intoWorkspace = target[0] !== '..' && !target.includes('node_modules');
  return intoWorkspace ? link : entry;
};

const linkDependencies = (repo, from, to) => {
  mkdirSync(to);
  for (const name of readdirSync(from)) {
    const entry = join(from, name);
    const link = lstatSync(entry).isSymbolicLink() ? readlinkSync(entry) : undefined;
    if (link === undefined && name.startsWith('@')) linkDependencies(repo, entry, join(to, name));
    else symlinkSync(linkTargetOf(repo, entry, link), join(to, name));
  }
};

/** The env the push suite gives the `tools` step, which runs in an export that is not a git repo. */
export const toolsStepEnv = (repo) => ({ ETHLETE_REPO_ROOT: repo });

/** Links the installed dependencies of `repo` (root and workspace projects) into `dir`; never writes inside `repo`. */
export const linkInstalledDependencies = (repo, dir) => {
  if (existsSync(join(repo, 'node_modules')))
    linkDependencies(repo, join(repo, 'node_modules'), join(dir, 'node_modules'));
  for (const parent of WORKSPACE_PARENTS.filter((name) => existsSync(join(dir, name))))
    for (const name of readdirSync(join(dir, parent))) {
      const dependencies = join(repo, parent, name, 'node_modules');
      if (existsSync(dependencies)) linkDependencies(repo, dependencies, join(dir, parent, name, 'node_modules'));
    }
};

/** Lists `node_modules/@scope/<name>` symlinks of `repo` that resolve to their own scope folder or an ancestor of it. */
export const scopeSelfLinks = (repo) => {
  const modules = join(repo, 'node_modules');
  if (!existsSync(modules)) return [];
  const found = [];
  for (const scope of readdirSync(modules).filter((name) => name.startsWith('@'))) {
    const scopeDir = join(modules, scope);
    if (!lstatSync(scopeDir).isDirectory()) continue;
    for (const name of readdirSync(scopeDir)) {
      const entry = join(scopeDir, name);
      if (!lstatSync(entry).isSymbolicLink()) continue;
      const target = resolve(scopeDir, readlinkSync(entry));
      if (scopeDir === target || scopeDir.startsWith(target + sep)) found.push(entry);
    }
  }
  return found;
};

export const scopeSelfLinksMessage = (links) =>
  [
    `node_modules holds ${links.length} scope self-link(s) that break the TypeScript type roots (TS2688):`,
    ...links.map((link) => `  ${link}`),
    'Remove them with `rm <path>` (they are symlinks; never `rm -r`). Never link into the repo node_modules; use `yarn scratch:checkout`.',
  ].join('\n');

/** Extracts `sha` of `repo` into a new temp dir and links the repo's installed dependencies into it. */
export const exportCommit = (repo, sha, prefix = 'push-suite') => {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-${sha.slice(0, 12)}-`));
  const extract = spawnSync('bash', ['-c', 'set -o pipefail; git archive "$1" | tar -x -C "$2"', 'export', sha, dir], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (extract.status !== 0) return { dir, error: extract.stderr.trim() || `git archive exited ${extract.status}` };
  linkInstalledDependencies(repo, dir);
  return { dir };
};

/** Applies the reverse of commit `sha` of `repo` to the export in `dir`; returns `{ error }` when it does not apply. */
export const revertInExport = (repo, sha, dir) => {
  const diff = spawnSync('git', ['diff', '--binary', `${sha}^`, sha], { cwd: repo, encoding: 'utf8' });
  if (diff.status !== 0) return { error: diff.stderr.trim() || `git diff exited ${diff.status}` };
  const apply = spawnSync('git', ['apply', '-R'], { cwd: dir, input: diff.stdout, encoding: 'utf8' });
  if (apply.status !== 0)
    return { error: `the reverse of ${sha} does not apply to the export: ${apply.stderr.trim()}` };
  return {};
};
