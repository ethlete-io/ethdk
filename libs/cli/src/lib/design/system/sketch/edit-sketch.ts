import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { assetDirsOf, filesBelow } from '../assets';
import { productSharedDirsOf } from '../imports';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { partHashOf } from './baseline';
import { EDIT_SKETCH, readMerged } from './merged-parts';
import {
  createSketch,
  markSketchReady,
  rebaseOutsideImports,
  rewriteSharedImports,
  SHARED_FOLDER,
  Sketch,
  variantSharedDirOf,
  writeSketchFile,
} from './sketch';

export const EDIT_OLD = 'old';
const NEW = 'new';
const EDIT_ROUND_TITLE = 'Direkte Änderung';
const EDIT_VARIANT_NOTES = { [EDIT_OLD]: 'der zuletzt gemergte Stand', [NEW]: 'die Änderung außerhalb eines Sketches' };

const editRoundNoteOf = (part: string) =>
  `${part} wurde außerhalb eines Sketches geändert und sieht anders aus - wähle den zuletzt gemergten Stand oder die Änderung`;
const newOnlyRoundNoteOf = (part: string) =>
  `${part} wurde außerhalb eines Sketches geändert und der zuletzt gemergte Stand ist nicht mehr zu finden - wähle die Änderung oder setze sie zurück`;

export const EDIT_OLD_NOT_FOUND = 'EDIT-OLD-NOT-FOUND';

export type EditOldNotFound = { rule: typeof EDIT_OLD_NOT_FOUND; message: string };

type OldDesign = { commit: string; files: Map<string, Buffer> };

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });

const blobsAt = ({ root, commit, paths }: { root: string; commit: string; paths: string[] }) =>
  git(root, ['ls-tree', '-r', '-z', commit, '--', ...paths.map((path) => `./${path}`)])
    .split('\0')
    .flatMap((entry) => {
      const [meta, path] = entry.split('\t');
      const [, type, oid] = meta?.split(' ') ?? [];

      return type === 'blob' && oid && path ? [{ oid, path }] : [];
    });

const oldDesignOf = (product: ResolvedProduct, resolved: ResolvedPart): OldDesign | EditOldNotFound | string => {
  const part = partKeyOf(resolved);
  const hash = readMerged(product.dir)[part];

  if (hash === undefined) return `${part} has no merged hash - there is no old design to show`;

  const root = repoRootOf(product);
  const partDir = relative(root, dirname(resolved.file));
  const paths = [
    partDir,
    ...[...productSharedDirsOf(product), ...assetDirsOf(product)].map((dir) => relative(root, dir)),
  ];
  const blobs = new Map<string, Buffer>();
  const blobOf = (oid: string) => {
    const cached =
      blobs.get(oid) ??
      execFileSync('git', ['cat-file', 'blob', oid], { cwd: root, stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 });

    blobs.set(oid, cached);

    return cached;
  };
  const scratch = mkdtempSync(join(tmpdir(), 'et-design-edit-old-'));
  const at = (dir: string) => join(scratch, relative(root, dir));

  try {
    const commits = git(root, ['log', '--format=%H', 'HEAD', '--', ...paths.map((path) => `./${path}`)])
      .split('\n')
      .filter((line) => line !== '');

    for (const commit of commits) {
      rmSync(scratch, { recursive: true, force: true });
      mkdirSync(scratch);

      const tree = blobsAt({ root, commit, paths });

      for (const { oid, path } of tree) {
        mkdirSync(dirname(join(scratch, path)), { recursive: true });
        writeFileSync(join(scratch, path), blobOf(oid));
      }

      const moved = {
        ...product,
        dir: at(product.dir),
        base: product.base && { ...product.base, dir: at(product.base.dir) },
      };

      if (partHashOf({ product: moved, dir: join(scratch, partDir) }) !== hash) continue;

      const files = tree.flatMap(({ oid, path }) =>
        path.startsWith(`${partDir}/`) ? [[relative(partDir, path), blobOf(oid)] as const] : [],
      );

      return { commit, files: new Map(files) };
    }
  } catch (error) {
    return `${part} has no history to find its old design in: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  return {
    rule: EDIT_OLD_NOT_FOUND,
    message:
      `no commit holds ${part} at its merged hash ${hash}, so the edit has no old design to compare with - ` +
      `${part} gets a sketch with only the variant new: the user picks it to record the edit, or the change is reverted`,
  };
};

/**
 * Opens the old/new sketch of a merged part edited outside a sketch, ready for a pick: `old` holds the part's folder at
 * the newest commit whose part hash is its merged hash, `new` the working one. When no commit has that hash it opens the
 * sketch with only `new` and answers `EDIT-OLD-NOT-FOUND` with it; else the sketch, or why it cannot open.
 */
export const openEditSketch = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
  author?: string;
}): Sketch | (EditOldNotFound & { sketch: Sketch }) | string => {
  const { target, product, part } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;

  const old = oldDesignOf(product, resolved);

  if (typeof old === 'string') return old;
  if ('rule' in old) {
    const created = createSketch({
      product,
      sketch: { layer: resolved.layer, name: resolved.name, sketch: EDIT_SKETCH },
      variants: [NEW],
      roundTitle: EDIT_ROUND_TITLE,
      roundNote: newOnlyRoundNoteOf(part),
      variantNotes: new Map([[NEW, EDIT_VARIANT_NOTES[NEW]]]),
      author: options.author,
      merge: resolved.origin === 'overridden' ? 'override' : undefined,
    });

    if (typeof created === 'string') return created;

    const ready = markSketchReady({ checkout: target, sketch: created, author: options.author });

    return typeof ready === 'string' ? ready : { ...old, sketch: ready };
  }

  const partDir = dirname(resolved.file);
  const working = filesBelow(partDir);
  const unchanged =
    working.length === old.files.size &&
    working.every((file) => old.files.get(relative(partDir, file))?.equals(readFileSync(file)));

  if (unchanged)
    return `the folder of ${part} at its merged commit ${old.commit.slice(0, 9)} equals the working one - there is no old design to show`;

  const created = createSketch({
    product,
    sketch: { layer: resolved.layer, name: resolved.name, sketch: EDIT_SKETCH },
    variants: [NEW, EDIT_OLD],
    roundTitle: EDIT_ROUND_TITLE,
    roundNote: editRoundNoteOf(part),
    variantNotes: new Map(Object.entries(EDIT_VARIANT_NOTES)),
    author: options.author,
    merge: resolved.origin === 'overridden' ? 'override' : undefined,
  });

  if (typeof created === 'string') return created;

  writeOld({ sketch: created, resolved }, old.files);

  return markSketchReady({ checkout: target, sketch: created, author: options.author });
};

/**
 * Rewrites the `old` variant of an edit sketch from the part at its merged commit, as `openEditSketch` finds it, so `old` draws against the sketch's `shared/` of
 * today, and its round and variant notes in today's wording. Answers why it cannot, else null.
 */
export const refreshEditOld = ({
  product,
  sketch,
}: {
  product: ResolvedProduct;
  sketch: Sketch;
}): EditOldNotFound | string | null => {
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(sketch));

  if (!resolved) return `product "${product.name}" has no part "${partKeyOf(sketch)}"`;

  const old = oldDesignOf(product, resolved);

  if (typeof old === 'string' || 'rule' in old) return old;

  writeOld({ sketch, resolved }, old.files);
  rewordEditNotes(sketch);

  return null;
};

/** Rewrites the round and variant notes of an edit sketch in today's wording, writing only when they differ. */
export const rewordEditNotes = (sketch: Sketch) => {
  const [first, ...later] = sketch.rounds;
  const rounds = first
    ? [{ ...first, title: EDIT_ROUND_TITLE, note: editRoundNoteOf(partKeyOf(sketch)) }, ...later]
    : sketch.rounds;
  const variantInfo = Object.fromEntries(
    Object.entries(sketch.variantInfo).map(([variant, info]) => [
      variant,
      variant === EDIT_OLD || variant === NEW ? { ...info, note: EDIT_VARIANT_NOTES[variant] } : info,
    ]),
  );
  const reworded = { ...sketch, rounds, variantInfo };

  if (JSON.stringify(reworded) !== JSON.stringify(sketch)) writeSketchFile(reworded);
};

const writeOld = ({ sketch, resolved }: { sketch: Sketch; resolved: ResolvedPart }, files: Map<string, Buffer>) => {
  const oldDir = resolve(sketch.dir, EDIT_OLD, resolved.layer, resolved.name);

  rmSync(oldDir, { recursive: true, force: true });
  rmSync(variantSharedDirOf(sketch, EDIT_OLD), { recursive: true, force: true });

  for (const [path, source] of files) {
    const file = resolve(oldDir, path);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }

  const partDir = dirname(resolved.file);

  rebaseOutsideImports({ dir: oldDir, from: partDir, skip: SHARED_FOLDER });

  if (existsSync(resolve(oldDir, SHARED_FOLDER))) {
    rebaseOutsideImports({
      dir: resolve(oldDir, SHARED_FOLDER),
      from: resolve(partDir, SHARED_FOLDER),
      settledIn: variantSharedDirOf(sketch, EDIT_OLD),
    });
    rewriteSharedImports(oldDir);
    cpSync(resolve(oldDir, SHARED_FOLDER), variantSharedDirOf(sketch, EDIT_OLD), { recursive: true });
    rmSync(resolve(oldDir, SHARED_FOLDER), { recursive: true });
  }
};
