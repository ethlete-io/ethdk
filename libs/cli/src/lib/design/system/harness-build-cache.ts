import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { sha16 } from './design-hash';

const KEEP_BUILDS = 2;
const IN_USE = '.in-use-';
const INSTALL_STATES = ['.yarn-state.yml', '.package-lock.json', '.modules.yaml', '.yarn-integrity'];

const gitOf = (cwd: string, args: string[]) =>
  execFileSync('git', ['--no-optional-locks', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const blobShaOf = (file: string) => {
  const stat = lstatSync(file, { throwIfNoEntry: false });

  if (!stat) return null;

  const content = stat.isSymbolicLink() ? Buffer.from(readlinkSync(file)) : stat.isFile() ? readFileSync(file) : null;

  if (!content) return 'dir';

  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
};

const workTreeFilesOf = (target: string) => {
  let root: string;

  try {
    root = gitOf(target, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }

  const files = new Map<string, string>();

  for (const entry of gitOf(root, ['ls-files', '-s', '-z']).split('\0')) {
    const match = /^\d+ ([0-9a-f]+) (\d)\t(.+)$/u.exec(entry);

    if (!match) continue;
    if (match[2] !== '0') return null;

    files.set(match[3] as string, match[1] as string);
  }

  for (const entry of gitOf(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']).split(
    '\0',
  )) {
    if (entry.length < 4 || entry[1] === ' ') continue;

    const path = entry.slice(3);
    const sha = blobShaOf(join(root, path));

    if (sha === null) files.delete(path);
    else files.set(path, sha);
  }

  return { root, files };
};

const installedPackagesOf = (dir: string) => {
  const modules = join(dir, 'node_modules');
  const stamp = (path: string) => {
    const stat = statSync(join(modules, path), { throwIfNoEntry: false });

    return stat ? [`${path}\0${stat.mtimeMs}\0${stat.size}`] : [];
  };
  const namesOf = (path: string) => {
    try {
      return readdirSync(join(modules, path)).filter((name) => !name.startsWith('.'));
    } catch {
      return [];
    }
  };
  const packages = namesOf('').flatMap((name) =>
    name.startsWith('@') ? namesOf(name).map((inner) => `${name}/${inner}`) : [name],
  );

  return [...INSTALL_STATES.flatMap(stamp), ...packages.sort().flatMap((name) => stamp(`${name}/package.json`))];
};

/**
 * The key of everything a harness build can read: the content of every tracked and not ignored untracked file of the
 * git checkout, each installed package, the Node version and the build command. `null` outside a git checkout or with
 * unresolved merge conflicts, where no build may be reused.
 */
export const harnessBuildKeyOf = (options: { target: string; command: string[] }): string | null => {
  let tree: ReturnType<typeof workTreeFilesOf>;

  try {
    tree = workTreeFilesOf(options.target);
  } catch {
    return null;
  }

  if (!tree) return null;

  const hash = createHash('sha256');

  hash.update(`${process.version}\0${options.command.join('\0')}\0`);

  for (const [path, sha] of [...tree.files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    hash.update(`${path}\0${sha}\n`);

  for (const dir of new Set([tree.root, resolve(options.target)]))
    for (const line of installedPackagesOf(dir)) hash.update(`${dir}\0${line}\n`);

  return hash.digest('hex').slice(0, 32);
};

/** The folder that keeps the reusable harness builds of `project` in the checkout at `target`. */
export const harnessCacheDirOf = (options: { target: string; project: string; base?: string }) =>
  join(
    options.base ?? join(tmpdir(), 'et-design-harness-cache'),
    sha16(`${resolve(options.target)}\0${options.project}`),
  );

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const inUseOf = (dir: string, key: string) =>
  readdirSync(dir)
    .filter((name) => name.startsWith(`${IN_USE}${key}-`))
    .some((name) => {
      if (alive(Number(name.slice(`${IN_USE}${key}-`.length)))) return true;

      rmSync(join(dir, name), { force: true });

      return false;
    });

const prune = (dir: string, keep: string) => {
  const builds = readdirSync(dir)
    .filter((name) => !name.startsWith('.') && name !== keep)
    .map((name) => ({ name, at: statSync(join(dir, name), { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
    .sort((a, b) => b.at - a.at);

  for (const { name } of builds.slice(KEEP_BUILDS - 1))
    if (!inUseOf(dir, name)) rmSync(join(dir, name), { recursive: true, force: true });
};

/**
 * Marks the build under `key` in `dir` as served by this process and returns its folder and the release, or `null`
 * when there is no such build.
 */
export const claimHarnessBuild = (dir: string, key: string) => {
  const build = join(dir, key);
  const marker = join(dir, `${IN_USE}${key}-${process.pid}`);

  if (!existsSync(build)) return null;

  writeFileSync(marker, '');

  if (!existsSync(build)) {
    rmSync(marker, { force: true });

    return null;
  }

  const now = new Date();

  utimesSync(build, now, now);

  return { dir: build, release: () => rmSync(marker, { force: true }) };
};

/**
 * Moves a finished build from `outputPath` into `dir` under `key`, claims it and drops older builds no process
 * serves. Returns `null` when the move fails; the caller then serves `outputPath` itself.
 */
export const storeHarnessBuild = (options: { dir: string; key: string; outputPath: string }) => {
  const { dir, key, outputPath } = options;

  try {
    mkdirSync(dir, { recursive: true });

    if (!existsSync(join(dir, key))) renameSync(outputPath, join(dir, key));
  } catch {
    if (!existsSync(join(dir, key))) return null;
  }

  const claimed = claimHarnessBuild(dir, key);

  if (claimed) prune(dir, key);

  return claimed;
};
