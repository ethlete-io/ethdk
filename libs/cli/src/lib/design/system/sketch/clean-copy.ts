import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path';

const WORK_FOLDER = '.design-explore';

const realOf = (path: string): string => {
  if (existsSync(path)) return realpathSync(path);

  const parent = dirname(path);

  return parent === path ? path : join(realOf(parent), basename(path));
};

const escapes = (rel: string) => rel === '..' || rel.startsWith('../') || isAbsolute(rel);

export type CleanCopy = {
  root: string;
  inCopy: (path: string) => string;
  inCheckout: (path: string) => string;
  relativeOf: (path: string) => string;
  drop: () => void;
};

const committedInto = (options: { target: string; rel: string; to: string }) => {
  const prefix = spawnSync('git', ['rev-parse', '--show-prefix'], { cwd: options.target, encoding: 'utf8' });

  if (prefix.status !== 0) return false;

  const tar = resolve(dirname(options.to), `${basename(options.to)}.tar`);
  const archived = spawnSync(
    'git',
    ['archive', '--format=tar', '-o', tar, `HEAD:${prefix.stdout.trim()}${options.rel}`],
    { cwd: options.target, encoding: 'utf8' },
  );

  if (archived.status !== 0) return false;

  mkdirSync(options.to, { recursive: true });

  const extracted = spawnSync('tar', ['-xf', tar, '-C', options.to], { encoding: 'utf8' });

  rmSync(tar, { force: true });

  return extracted.status === 0;
};

/**
 * A copy of the checkout in which each folder of `cloned` holds its committed state (the working tree's
 * outside git) and every other entry links to the checkout. `node_modules` is a folder of links of its own, so
 * the tool's work files stay in the copy. `.git` is left out, so git in the copy never sees the checkout.
 */
export const cleanCopyOf = (options: { target: string; cloned: string[] }): CleanCopy => {
  const { target } = options;
  const realTarget = realpathSync(target);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ethlete-sketch-merge-')));
  const relativeOf = (path: string) => {
    const rel = relative(target, path);

    return escapes(rel) ? relative(realTarget, realOf(path)) : rel;
  };
  const wanted = options.cloned
    .map(relativeOf)
    .filter((rel) => rel !== '' && !escapes(rel) && existsSync(resolve(target, rel)));
  const cloned = [...new Set(wanted)].filter((rel) => !wanted.some((other) => rel.startsWith(`${other}/`)));
  const holdsCloned = (rel: string) => cloned.some((path) => path.startsWith(`${rel}/`));

  const mirror = (rel: string) => {
    for (const name of readdirSync(resolve(target, rel))) {
      const entry = rel === '' ? name : `${rel}/${name}`;
      const into = resolve(root, entry);

      if (name === '.git' && rel === '') continue;
      if (cloned.includes(entry)) continue;

      if (holdsCloned(entry)) {
        mkdirSync(into, { recursive: true });
        mirror(entry);
      } else if (entry === 'node_modules' && statSync(resolve(target, entry)).isDirectory()) {
        mkdirSync(into, { recursive: true });

        for (const module of readdirSync(resolve(target, entry)).filter((module) => module !== WORK_FOLDER))
          symlinkSync(resolve(realTarget, entry, module), resolve(into, module));
      } else {
        symlinkSync(resolve(realTarget, entry), into);
      }
    }
  };

  mirror('');

  for (const rel of cloned) {
    const to = resolve(root, rel);

    mkdirSync(dirname(to), { recursive: true });

    if (!committedInto({ target, rel, to })) {
      rmSync(to, { recursive: true, force: true });
      cpSync(resolve(target, rel), to, { recursive: true });
    }
  }

  return {
    root,
    inCopy: (path) => resolve(root, relativeOf(path)),
    inCheckout: (path) => resolve(target, relative(root, path)),
    relativeOf,
    drop: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** Each file below `paths` - a path may be a file - with its bytes. */
export const contentsBelow = (paths: string[]) => {
  const contents = new Map<string, Buffer>();
  const visit = (path: string) => {
    if (!existsSync(path)) return;

    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) visit(resolve(path, name));

      return;
    }

    contents.set(path, readFileSync(path));
  };

  paths.forEach(visit);

  return contents;
};
