import { createHash } from 'crypto';
import { catFilesOf, git } from '../../git-reader';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { filesBelow } from '../assets';
import { gitTopOf } from '../../git-top';
import { LAYERS } from '../layers';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { isEditSketch } from './merged-parts';
import { rebaseOutsideImports, Sketch } from './sketch';

export const EDIT_OLD = 'old';
export const EDIT_NEW = 'new';

const EDIT_OLD_BASE_FOLDER = join('node_modules', '.cache', 'ethlete-design', 'edit-old-base');

/** Whether `file` belongs to the snapshot an edit sketch's `old` variant draws its other parts from, not to the variant. */
export const isEditOldBaseFile = (file: string) => file.includes(`${sep}${EDIT_OLD_BASE_FOLDER}${sep}`);

const posix = (path: string) => path.split(sep).join('/');

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
    `${commit}-${createHash('sha1').update(productPath).digest('hex').slice(0, 12)}`,
  );
  const dirs = { raw: resolve(root, 'raw', productPath), drawn: resolve(root, 'drawn', productPath) };

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

  rebaseOutsideImports({ dir: resolve(scratch, 'drawn', productPath), from: productDir });

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

  let at: { raw: string; drawn: string };

  try {
    const top = gitTopOf(product.dir);
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

    if (current && current.origin !== 'base' && sameFolder(dirname(current.file), raw)) return current;

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
