import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

export const gitOrNull = (cwd: string, args: string[]) => {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
};

/**
 * The commit the gate compares HEAD with: `base`, else the merge base of HEAD and `branch` (a product's
 * `harness.baseBranch`), else of HEAD and the branch `origin/HEAD` names.
 */
export const baseCommitOf = (options: { root: string; base: string | undefined; branch?: string }) => {
  const branch =
    options.branch ??
    gitOrNull(options.root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])?.trim();

  if (!options.base && !branch) return 'no origin/HEAD to compare with - pass --base <rev> or set harness.baseBranch';

  const rev = options.base ?? gitOrNull(options.root, ['merge-base', 'HEAD', branch ?? ''])?.trim();

  if (!rev) return `no merge base of HEAD and ${branch} - pass --base <rev>`;

  return (
    gitOrNull(options.root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])?.trim() || `no commit "${rev}"`
  );
};

const linkNodeModules = (options: { root: string; clone: string }) => {
  const { root, clone } = options;
  const modules = join(root, 'node_modules');
  const linked = join(clone, 'node_modules');

  if (!existsSync(linked) && existsSync(modules)) {
    mkdirSync(linked);

    for (const name of readdirSync(modules)) {
      const entry = join(modules, name);

      if (lstatSync(entry).isSymbolicLink()) symlinkSync(readlinkSync(entry), join(linked, name));
      else if (name === '@ethlete') {
        mkdirSync(join(linked, name));

        for (const scoped of readdirSync(entry)) {
          const from = join(entry, scoped);

          symlinkSync(lstatSync(from).isSymbolicLink() ? readlinkSync(from) : from, join(linked, name, scoped));
        }
      } else symlinkSync(entry, join(linked, name));
    }
  }

  for (const top of ['libs', 'apps', 'tools']) {
    if (!existsSync(join(root, top))) continue;

    for (const name of readdirSync(join(root, top))) {
      const nested = join(top, name, 'node_modules');

      if (existsSync(join(root, nested)) && existsSync(join(clone, top, name)) && !existsSync(join(clone, nested)))
        symlinkSync(join(root, nested), join(clone, nested));
    }
  }
};

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/**
 * A shared clone of the checkout at `commit`, with the checkout's node_modules linked in. It reuses one folder per
 * checkout so the harness build cache, keyed by that path, survives runs; a second run at once gets a fresh folder. A
 * reused clone that cannot check out `commit` is cloned again in the same folder.
 */
export const baseCheckoutOf = (options: { root: string; commit: string }) => {
  const stable = join(
    tmpdir(),
    'et-design-visible-change',
    createHash('sha256').update(options.root).digest('hex').slice(0, 16),
  );
  const lock = `${stable}.lock`;

  mkdirSync(join(stable, '..'), { recursive: true });

  const held = existsSync(lock) && alive(Number(readFileSync(lock, 'utf8')));
  const dir = held ? mkdtempSync(join(tmpdir(), 'et-design-visible-change-')) : stable;

  if (!held) writeFileSync(lock, String(process.pid));

  const reused =
    existsSync(join(dir, '.git')) &&
    gitOrNull(dir, ['checkout', '--quiet', '--force', '--detach', options.commit]) !== null;

  if (!reused) {
    rmSync(dir, { recursive: true, force: true });
    git(options.root, ['clone', '--quiet', '--shared', '--no-checkout', options.root, dir]);
    git(dir, ['checkout', '--quiet', '--detach', options.commit]);
  }

  linkNodeModules({ root: options.root, clone: dir });

  return {
    dir,
    release: () => (held ? rmSync(dir, { recursive: true, force: true }) : rmSync(lock, { force: true })),
  };
};
