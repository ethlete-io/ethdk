import { catFilesOf, git as gitText } from '../../git-reader';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { assetDirsOf, filesBelow } from '../assets';
import { partInputsOf } from './baseline';
import { productSharedDirsOf, SHARED_PREFIX } from '../imports';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { EDIT_SKETCH, isEditSketch, readMerged } from './merged-parts';
import { MERGE_WAIT_MS } from './merge-step';
import { journaledAsync } from '../write-journal';
import { IdenticalRender } from './identical-renders';
import {
  createSketch,
  markSketchReady,
  rebaseOutsideImports,
  rewriteSharedImports,
  SHARED_FOLDER,
  sharedDirOf,
  Sketch,
  SOURCE_FILE,
  variantDirOf,
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

export const EDIT_DISCARD_REFUSED = 'EDIT-DISCARD-REFUSED';

/**
 * Why `sketch discard` refuses the sketch: an old/new edit sketch has no discard while its edit is open, nor while its
 * pick contradicts the part HEAD holds. `null` for any other sketch, and for a stale edit sketch (`isStaleEditSketch`).
 */
export const editDiscardRefusalOf = (product: ResolvedProduct, sketch: Sketch) => {
  if (!isEditSketch(sketch)) return null;
  if (!isStaleEditSketch(product, sketch))
    return `${EDIT_DISCARD_REFUSED}: ${sketch.target} is the old/new sketch of a direct edit and cannot be discarded - pick ${EDIT_OLD} to undo the edit or ${NEW} to keep it`;
  if (pickContradictsPart(product, sketch))
    return `${EDIT_DISCARD_REFUSED}: ${sketch.target} cannot be discarded - ${pickedEditRemedyOf(product, sketch)}`;

  return null;
};

/** Whether `sketch` is a direct-edit sketch whose part HEAD holds as it is in the working tree: committed or restored. */
export const isStaleEditSketch = (product: ResolvedProduct, sketch: Pick<Sketch, 'target' | 'layer' | 'name'>) => {
  if (!isEditSketch(sketch)) return false;

  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(sketch));

  return resolved !== undefined && resolved.origin !== 'base' && headHoldsPart(product, resolved);
};

/** Whether `sketch` is a ready old/new edit sketch, undecided or picked, without a hold or a rejection: the one a check settles once HEAD holds its part. */
export const isOpenOrPickedEditSketch = (
  sketch: Pick<Sketch, 'target' | 'layer' | 'name' | 'status' | 'decision' | 'hold' | 'rejections'>,
) =>
  sketch.target === `${partKeyOf(sketch)}@${EDIT_SKETCH}` &&
  sketch.status === 'ready' &&
  (!sketch.decision || sketch.decision.kind === 'pick') &&
  !sketch.hold &&
  Object.values(sketch.rejections ?? {}).every((rejections) => rejections.length === 0);

type Roots = { part: string; shared: string[] };

const insideOf = (dir: string, path: string) => {
  const rest = relative(dir, path);

  return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
};

const canonicalOf = (file: string, roots: Roots) => {
  const source = readFileSync(file);

  if (!SOURCE_FILE.test(file)) return source.toString('base64');

  return source
    .toString('utf8')
    .replace(/(['"])(\.{1,2}\/[^'"]+)\1/gu, (...[, quote = '', specifier = '']: string[]) => {
      const path = resolve(dirname(file), specifier);
      const shared = roots.shared.find((dir) => insideOf(dir, path));

      if (shared !== undefined) return `${quote}${SHARED_PREFIX}${relative(shared, path).split(sep).join('/')}${quote}`;

      return `${quote}${insideOf(roots.part, path) ? `<part>/${relative(roots.part, path).split(sep).join('/')}` : path}${quote}`;
    });
};

/**
 * Whether the part folder holds `variant` of its edit sketch: each file alike once relative imports name the file they
 * reach, the part's own `shared/` files matched with the variant's (`variantSharedDirOf`, else the sketch's `shared/`).
 */
const partHoldsVariant = (options: {
  product: ResolvedProduct;
  resolved: ResolvedPart;
  sketch: Sketch;
  variant: string;
}) => {
  const { product, resolved, sketch, variant } = options;
  const partDir = dirname(resolved.file);
  const partShared = resolve(partDir, SHARED_FOLDER);
  const variantDir = resolve(variantDirOf(sketch, variant), resolved.layer, resolved.name);
  const variantShared = [variantSharedDirOf(sketch, variant), sharedDirOf(sketch)];
  const files = partInputsOf({ product, dir: partDir }).files;
  const generated = new Set(
    filesBelow(partDir)
      .filter((file) => !files.includes(file))
      .map((file) => relative(partDir, file)),
  );
  const own = files.filter((file) => !insideOf(partShared, file));
  const drawn = filesBelow(variantDir).filter((file) => !generated.has(relative(variantDir, file)));

  if (drawn.length !== own.length) return false;

  const partRoots = { part: partDir, shared: [partShared] };
  const variantRoots = { part: variantDir, shared: variantShared };
  const sameFile = (file: string, twin: string | undefined) =>
    twin !== undefined && existsSync(twin) && canonicalOf(file, partRoots) === canonicalOf(twin, variantRoots);

  return (
    own.every((file) => sameFile(file, resolve(variantDir, relative(partDir, file)))) &&
    files
      .filter((file) => insideOf(partShared, file))
      .every((file) =>
        sameFile(
          file,
          variantShared.map((dir) => resolve(dir, relative(partShared, file))).find((twin) => existsSync(twin)),
        ),
      )
  );
};

/**
 * Whether `sketch` is an edit sketch picked against its part: the part folder does not hold the picked variant's files.
 * A check keeps such a sketch; `pickedEditRemedyOf` names its way out.
 */
export const pickContradictsPart = (product: ResolvedProduct, sketch: Sketch) => {
  if (!isEditSketch(sketch) || sketch.decision?.kind !== 'pick') return false;

  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(sketch));

  return resolved !== undefined && !partHoldsVariant({ product, resolved, sketch, variant: sketch.decision.variant });
};

/** The one way out of an edit sketch whose pick contradicts its part (`pickContradictsPart`): its merge, which writes the picked variant into the part. */
export const pickedEditRemedyOf = (product: ResolvedProduct, sketch: Pick<Sketch, 'target' | 'decision'>) => {
  const variant = sketch.decision?.kind === 'pick' ? sketch.decision.variant : '';

  return `the pick of ${variant} contradicts the part at HEAD - merge it to restore the part to ${variant}: sketch merge ${sketch.target} --product ${product.name} --by <model id>`;
};

/** Whether `renders` show an edit sketch's `new` and `old` drawing like the part now in every state; never for a pick of `old`. */
export const editHoldsOf = (
  sketch: Pick<Sketch, 'target' | 'layer' | 'name' | 'decision'>,
  renders: IdenticalRender[],
) => {
  if (!isEditSketch(sketch) || (sketch.decision?.kind === 'pick' && sketch.decision.variant === EDIT_OLD)) return false;

  const twinOf = (variant: string) => renders.find((render) => render.variant === variant && render.everyState);
  const old = twinOf(EDIT_OLD);

  return twinOf(NEW)?.sibling === null && old !== undefined && (old.sibling === null || old.sibling === NEW);
};

export type EditOldNotFound = { rule: typeof EDIT_OLD_NOT_FOUND; message: string };

type OldDesign = Map<string, Buffer>;

const git = (root: string, args: string[]) => gitText(args, { cwd: root, stdio: 'pipe' });

const blobsAt = ({ root, commit, paths }: { root: string; commit: string; paths: string[] }) =>
  git(root, ['ls-tree', '-r', '-z', commit, '--', ...paths.map((path) => `./${path}`)])
    .split('\0')
    .flatMap((entry) => {
      const [meta, path] = entry.split('\t');
      const [, type, oid] = meta?.split(' ') ?? [];

      return type === 'blob' && oid && path ? [{ oid, path }] : [];
    });

const editPathsOf = (product: ResolvedProduct, resolved: ResolvedPart) => {
  const root = repoRootOf(product);

  return [dirname(resolved.file), ...productSharedDirsOf(product), ...assetDirsOf(product)].map((dir) =>
    relative(root, dir),
  );
};

/** Whether HEAD holds the part as it is in the working tree: its folder is tracked and git sees no change in it, its product's `shared/` or its assets. */
export const headHoldsPart = (product: ResolvedProduct, resolved: ResolvedPart) => {
  const root = repoRootOf(product);
  const paths = editPathsOf(product, resolved).map((path) => `./${path}`);

  try {
    return (
      git(root, ['ls-files', '--', paths[0] ?? '.']) !== '' &&
      git(root, ['--no-optional-locks', 'status', '--porcelain', '--untracked-files=all', '--', ...paths]) === ''
    );
  } catch {
    return false;
  }
};

/** Whether git tracks a file below `dir`; answers `true` when git cannot tell. */
export const tracksFileBelow = (product: ResolvedProduct, dir: string) => {
  const root = repoRootOf(product);

  try {
    return git(root, ['ls-files', '--', `./${relative(root, dir)}`]) !== '';
  } catch {
    return true;
  }
};

const oldDesignOf = (product: ResolvedProduct, resolved: ResolvedPart): OldDesign | EditOldNotFound | string => {
  const part = partKeyOf(resolved);

  if (readMerged(product.dir)[part] === undefined) return `${part} has no merged hash - there is no old design to show`;

  const root = repoRootOf(product);
  const partDir = relative(root, dirname(resolved.file));

  try {
    const tree = blobsAt({ root, commit: 'HEAD', paths: [partDir] });

    if (tree.length > 0) {
      const blobs = catFilesOf(
        tree.map(({ oid }) => oid),
        { cwd: root },
      );

      return new Map(
        tree.map(({ oid, path }, index) => {
          const blob = blobs[index];

          if (!blob) throw new Error(`git cannot read blob ${oid}`);

          return [relative(partDir, path), blob];
        }),
      );
    }
  } catch (error) {
    return `${part} has no history to find its old design in: ${error instanceof Error ? error.message : String(error)}`;
  }

  return {
    rule: EDIT_OLD_NOT_FOUND,
    message:
      `HEAD holds no file of ${part}, so the edit has no old design to compare with - ` +
      `${part} gets a sketch with only the variant new: the user picks it to record the edit, or the change is reverted`,
  };
};

/**
 * Opens the old/new sketch of a merged part edited outside a sketch, ready for a pick: `old` holds the part's folder at
 * HEAD, `new` the working one. When HEAD holds no file of the part it opens the sketch with only `new` and answers
 * `EDIT-OLD-NOT-FOUND` with it; else the sketch, or why it cannot open.
 */
export const openEditSketch = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
  author?: string;
}): Promise<Sketch | (EditOldNotFound & { sketch: Sketch }) | string> =>
  journaledAsync(
    {
      productDir: options.product.dir,
      root: options.target,
      label: `edit sketch of ${options.part}`,
      waitMs: MERGE_WAIT_MS,
    },
    () => openedEditSketch(options),
  );

const openedEditSketch = (options: {
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
  if (!(old instanceof Map)) {
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
    working.length === old.size &&
    working.every((file) => old.get(relative(partDir, file))?.equals(readFileSync(file)));

  if (unchanged) return `the folder of ${part} at HEAD equals the working one - there is no old design to show`;

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

  writeOld({ sketch: created, resolved }, old);

  return markSketchReady({ checkout: target, sketch: created, author: options.author });
};

/**
 * Rewrites the `old` variant of an edit sketch from the part at HEAD, as `openEditSketch` finds it, so `old` draws against the sketch's `shared/` of
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

  if (!(old instanceof Map)) return old;

  writeOld({ sketch, resolved }, old);
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

  if (JSON.stringify(reworded) !== JSON.stringify(sketch)) writeSketchFile(reworded, { base: sketch });
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
