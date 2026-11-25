import { createHash } from 'crypto';
import { catFilesOf, git } from '../../git-reader';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, posix as posixPath, relative, resolve, sep } from 'path';
import { filesBelow } from '../assets';
import { gitTopOf } from '../../git-top';
import { LAYERS } from '../layers';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { isEditSketch } from './merged-parts';
import { EDIT_OLD_BASE_FOLDER } from './edit-old-base-folder';
import { relativeSpecifierOf, Sketch } from './sketch';

export const EDIT_OLD = 'old';
export const EDIT_NEW = 'new';

const CACHE_FORMAT = 3;

const FOLLOWED_FILE = /\.(?:ts|js|mjs|css)$/u;

const followedFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => FOLLOWED_FILE.test(path))
        .map((path) => resolve(dir, path))
    : [];

const RELATIVE_SPECIFIER = /(['"])(\.{1,2}\/[^'"]+)\1/gu;

const posix = (path: string) => path.split(sep).join('/');

const relativeSpecifiersOf = (source: string) =>
  [...source.matchAll(RELATIVE_SPECIFIER)].map(([, , specifier = '']) => specifier);

const importedPathOf = (from: string, specifier: string) =>
  posixPath.join(posixPath.dirname(from), specifier.split('?')[0] ?? specifier);

const candidatesOf = (path: string) => [
  path,
  ...['.ts', '.mts', '.js', '.mjs'].map((extension) => `${path}${extension}`),
  path.replace(/\.(m?)js$/u, '.$1ts'),
  `${path}/index.ts`,
  `${path}/index.js`,
];

const isInside = (dir: string, path: string) => path === dir || path.startsWith(`${dir}/`);

const leavesProduct = (productPath: string, path: string) => !path.startsWith('..') && !isInside(productPath, path);

const blobsAtCommitOf = (options: { top: string; commit: string }) => {
  const listings = new Map<string, Map<string, string>>();

  return (path: string) => {
    const dir = posixPath.dirname(path);

    if (!listings.has(dir)) {
      const entries = git(['ls-tree', '-z', options.commit, '--', dir === '.' ? '.' : `${dir}/`], {
        cwd: options.top,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .split('\0')
        .flatMap((entry): [string, string][] => {
          const [meta, name] = entry.split('\t');
          const [, type, oid] = meta?.split(' ') ?? [];

          return type === 'blob' && oid && name ? [[posixPath.basename(name), oid]] : [];
        });

      listings.set(dir, new Map(entries));
    }

    return listings.get(dir)?.get(posixPath.basename(path)) ?? null;
  };
};

const outsideFilesAtCommitOf = (options: {
  top: string;
  commit: string;
  productPath: string;
  sources: { path: string; source: string }[];
}) => {
  const { top, commit, productPath } = options;
  const blobOf = blobsAtCommitOf({ top, commit });
  const reached = new Set<string>();
  const files = new Map<string, Buffer>();
  let queue = options.sources;

  while (queue.length > 0) {
    const wanted = new Map<string, string>();

    for (const { path, source } of queue) {
      for (const specifier of relativeSpecifiersOf(source)) {
        const imported = importedPathOf(path, specifier);

        if (!leavesProduct(productPath, imported) || reached.has(imported)) continue;

        const file = candidatesOf(imported).find((candidate) => blobOf(candidate) !== null);

        if (!file) continue;

        reached.add(imported);

        if (!files.has(file)) wanted.set(file, blobOf(file) ?? '');
      }
    }

    const blobs = catFilesOf([...wanted.values()], { cwd: top });

    queue = [...wanted.keys()].flatMap((path, index) => {
      const blob = blobs[index] ?? Buffer.alloc(0);

      files.set(path, blob);

      return FOLLOWED_FILE.test(path) ? [{ path, source: blob.toString('utf8') }] : [];
    });
  }

  return { reached, files };
};

const pointMissingImportsAtWorkingTree = (options: {
  top: string;
  drawnRoot: string;
  productPath: string;
  reached: Set<string>;
}) => {
  const { top, drawnRoot, productPath, reached } = options;

  for (const file of followedFilesIn(drawnRoot)) {
    const path = posix(relative(drawnRoot, file));
    const source = readFileSync(file, 'utf8');
    const rewritten = source.replace(RELATIVE_SPECIFIER, (...[match = '', quote = '', specifier = '']: string[]) => {
      const imported = importedPathOf(path, specifier);

      return isInside(productPath, imported) || reached.has(imported)
        ? match
        : `${quote}${relativeSpecifierOf({ from: file, to: resolve(top, dirname(path), specifier) })}${quote}`;
    });

    if (rewritten !== source) writeFileSync(file, rewritten);
  }
};

const isFile = (file: string) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

const outsideImportsUnchanged = (options: { top: string; drawnRoot: string; productPath: string; dir: string }) => {
  const { top, drawnRoot, productPath } = options;
  const seen = new Set<string>();
  const queue = followedFilesIn(options.dir);

  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const path = posix(relative(drawnRoot, file));

    for (const specifier of relativeSpecifiersOf(readFileSync(file, 'utf8'))) {
      const imported = importedPathOf(path, specifier);

      if (!leavesProduct(productPath, imported)) continue;

      const found = candidatesOf(imported).find((candidate) => isFile(resolve(drawnRoot, candidate)));

      if (!found || seen.has(found)) continue;

      seen.add(found);

      const old = resolve(drawnRoot, found);
      const now = resolve(top, found);

      if (!isFile(now) || !readFileSync(old).equals(readFileSync(now))) return false;
      if (FOLLOWED_FILE.test(found)) queue.push(old);
    }
  }

  return true;
};

const gitIn = (cwd: string, args: string[]) => git(args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const oldCommitOf = (top: string, sketch: Sketch) => {
  if (sketch.editOldCommit) return sketch.editOldCommit;

  try {
    return gitIn(top, ['rev-list', '-1', `--before=${sketch.createdAt}`, 'HEAD']) || null;
  } catch {
    return null;
  }
};

const productAtCommitOf = (options: { top: string; commit: string; productDir: string }) => {
  const { top, commit, productDir } = options;
  const productPath = posix(relative(top, productDir));
  const root = join(
    top,
    EDIT_OLD_BASE_FOLDER,
    `${commit}-${createHash('sha1').update(`${CACHE_FORMAT}:${productPath}`).digest('hex').slice(0, 12)}`,
  );
  const dirs = {
    raw: resolve(root, 'raw', productPath),
    drawn: resolve(root, 'drawn', productPath),
    drawnRoot: resolve(root, 'drawn'),
    productPath,
  };

  if (existsSync(root)) return dirs;

  const entries = git(['ls-tree', '-r', '-z', commit, '--', ...LAYERS.map((layer) => `./${productPath}/${layer}`)], {
    cwd: top,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\0')
    .flatMap((entry) => {
      const [meta, path] = entry.split('\t');
      const [, type, oid] = meta?.split(' ') ?? [];

      return type === 'blob' && oid && path ? [{ oid, path }] : [];
    });
  const blobs = catFilesOf(
    entries.map(({ oid }) => oid),
    { cwd: top },
  );

  mkdirSync(dirname(root), { recursive: true });

  const scratch = mkdtempSync(`${root}.`);

  for (const copy of ['raw', 'drawn']) {
    entries.forEach(({ path }, index) => {
      const file = resolve(scratch, copy, path);

      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, blobs[index] ?? Buffer.alloc(0));
    });
  }

  const outside = outsideFilesAtCommitOf({
    top,
    commit,
    productPath,
    sources: entries.flatMap(({ path }, index) =>
      FOLLOWED_FILE.test(path) ? [{ path, source: (blobs[index] ?? Buffer.alloc(0)).toString('utf8') }] : [],
    ),
  });

  for (const [path, blob] of outside.files) {
    const file = resolve(scratch, 'drawn', path);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, blob);
  }

  pointMissingImportsAtWorkingTree({
    top,
    drawnRoot: resolve(scratch, 'drawn'),
    productPath,
    reached: outside.reached,
  });

  try {
    renameSync(scratch, root);
  } catch {
    rmSync(scratch, { recursive: true, force: true });
  }

  return dirs;
};

const sameFolder = (a: string, b: string) => {
  const [left, right] = [filesBelow(a), filesBelow(b)];

  return (
    left.length === right.length &&
    left.every(
      (file, index) =>
        relative(a, file) === relative(b, right[index] ?? '') &&
        readFileSync(file).equals(readFileSync(right[index] ?? '')),
    )
  );
};

/**
 * The product the `old` variant of an edit sketch draws on: each part of the product's own folder as the commit
 * `old` was taken from holds it, so a later edit, a new part or a removed one does not reach the old design.
 * Any other sketch or variant, and a sketch outside git, draws on `product` as it is.
 */
export const editOldBaseOf = (options: { product: ResolvedProduct; sketch: Sketch; variant: string }) => {
  const { product, sketch, variant } = options;

  if (variant !== EDIT_OLD || !isEditSketch(sketch)) return product;

  let at: ReturnType<typeof productAtCommitOf>;
  let top: string;

  try {
    top = gitTopOf(product.dir);

    const commit = oldCommitOf(top, sketch);

    if (!commit) return product;

    at = productAtCommitOf({ top, commit, productDir: product.dir });
  } catch {
    return product;
  }

  const now = new Map(product.parts.map((part) => [partKeyOf(part), part]));
  const atCommit = partFilesOf(at.drawn).parts.map((file): ResolvedPart => {
    const current = now.get(partKeyOf(file));
    const raw = resolve(at.raw, relative(at.drawn, dirname(file.file)));

    if (
      current &&
      current.origin !== 'base' &&
      sameFolder(dirname(current.file), raw) &&
      outsideImportsUnchanged({ top, drawnRoot: at.drawnRoot, productPath: at.productPath, dir: dirname(file.file) })
    )
      return current;

    return {
      ...file,
      origin: current?.origin === 'overridden' || current?.origin === 'base' ? 'overridden' : 'product',
      source: readFileSync(file.file, 'utf8'),
      cssSource: file.css && existsSync(file.css) ? readFileSync(file.css, 'utf8') : null,
    };
  });
  const oldKeys = new Set(atCommit.map(partKeyOf));

  return {
    ...product,
    parts: [...product.parts.filter((part) => part.origin === 'base' && !oldKeys.has(partKeyOf(part))), ...atCommit],
  };
};
