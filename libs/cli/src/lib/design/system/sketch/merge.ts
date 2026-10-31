import { spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { DesignConfig } from '../../paths';
import { checkSystem, ruleLinesOf } from '../check-system';
import { addressSketchComments, resolveSketchEndComments } from '../comments/comment';
import { ASSETS_FOLDER, filesBelow } from '../assets';
import { fixturesOf, partFilesOf } from '../product';
import { isBuiltInBase } from '../base';
import { partKeyOf, ResolvedPart, ResolvedProduct, resolveProduct } from '../resolve-product';
import { conflictsOf } from './baseline';
import { prettierBinOf } from '../prettier';
import { carryShared, productSharedChangesOf, sharedPlanOf } from './merge-shared';
import { forgetMerged, recordMerged, rerecordChangedMerged, unchangedMergedOf } from './merged-parts';
import { madeByOf, noteOf, withMadeBy, withNote } from './part-definition';
import { authorsOf, clearSketchReport, rejectedProblemOf, Sketch, variantDirOf } from './sketch';

const swap = (entries: { from: string | null; to: string }[]) => {
  const backup = mkdtempSync(join(tmpdir(), 'ethlete-sketch-merge-'));
  const held = entries.map(({ to }, index) => {
    const copy = resolve(backup, String(index));

    if (existsSync(to)) cpSync(to, copy, { recursive: true });

    return { to, copy: existsSync(copy) ? copy : null };
  });

  for (const { from, to } of entries) {
    rmSync(to, { recursive: true, force: true });

    if (from === null) continue;

    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  }

  return {
    restore: () => {
      for (const { to, copy } of held) {
        rmSync(to, { recursive: true, force: true });

        if (copy) cpSync(copy, to, { recursive: true });
      }

      rmSync(backup, { recursive: true, force: true });
    },
    drop: () => rmSync(backup, { recursive: true, force: true }),
  };
};

const pickOf = (sketch: Sketch) => {
  const decision = sketch.decision;

  if (decision?.kind !== 'pick')
    return `${sketch.target} has no pick - the user picks a variant in Studio before a merge`;
  if (!sketch.variants.includes(decision.variant))
    return `${sketch.target} has no variant "${decision.variant}", the one picked - it has ${sketch.variants.join(', ') || 'none'}`;

  return { variant: decision.variant };
};

type NotedTarget = {
  key: string;
  targetDir: string;
  noteFile: string;
  inherited: ResolvedPart | null;
  noted: string;
};

const notedTargetOf = (options: {
  sketch: Sketch;
  variant: string;
  parts: { layer: string; name: string; file: string }[];
  product: ResolvedProduct;
  root: string;
  key: string;
  note?: string;
}): NotedTarget | string => {
  const { sketch, variant, parts, product, root, key, note } = options;
  const name = key.split('/')[1] ?? '';
  const targetDir = resolve(root, key);
  const noteFile = resolve(targetDir, `${name}.ts`);
  const carried = parts.find((part) => partKeyOf(part) === key)?.file;
  const inherited =
    carried || existsSync(noteFile) ? null : (product.parts.find((part) => partKeyOf(part) === key) ?? null);
  const held = carried ?? (inherited ? inherited.file : noteFile);

  if (!existsSync(held)) return `variant "${variant}" holds no ${key}, and the product has no ${key} to carry the note`;

  const source = readFileSync(held, 'utf8');
  const variantNote = sketch.variantInfo[variant]?.note;
  const newNote = note?.trim() || (noteOf(source)?.trim() === '' ? variantNote : undefined);
  const withNewNote = newNote ? withNote(source, newNote) : source;
  const madeBy = [...new Set([...madeByOf(source), ...authorsOf(sketch, variant)])];
  const noted = withNewNote === null || madeBy.length === 0 ? withNewNote : withMadeBy(withNewNote, madeBy);

  if (noted === null) return `${held} holds no definePart({ note: '…' }) to set the note on`;

  return { key, targetDir, noteFile, inherited, noted };
};

/** The parts of `keys` the merge writes into the product's base instead of the product. */
const baseKeysOf = (options: { product: ResolvedProduct; sketch: Sketch; keys: string[] }) => {
  const { product, sketch, keys } = options;

  return keys.filter((key) => {
    const origin = product.parts.find((part) => partKeyOf(part) === key)?.origin;

    return sketch.merge === 'into-base'
      ? origin === 'base' || origin === 'overridden'
      : sketch.merge !== 'override' && origin === 'base';
  });
};

/** Why a merge did nothing; `changed` names the parts a rebase must take in, `[]` when the sketch records no baseline. */
export type MergeRefusal = { reason: string; changed?: string[] };

const formatFiles = (target: string, files: string[]) => {
  const bin = prettierBinOf(target);

  if (!bin || files.length === 0) return;

  const formatted = spawnSync(process.execPath, [bin, '--write', '--ignore-unknown', '--log-level', 'warn', ...files], {
    cwd: target,
    encoding: 'utf8',
  });

  if (formatted.error || formatted.status !== 0)
    console.warn(`Could not format the merged files: ${(formatted.stderr || formatted.error?.message || '').trim()}`);
};

const mergeOrReason = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  note?: string;
  author?: string;
}): string[] | string | MergeRefusal => {
  const { target, config, product, sketch, note, author } = options;

  if (sketch.status !== 'ready') return `${sketch.target} is ${sketch.status} - mark it ready before a merge`;

  const pick = pickOf(sketch);

  if (typeof pick === 'string') return pick;

  const { variant } = pick;
  const rejected = rejectedProblemOf(sketch, variant);

  if (rejected) return rejected;

  const dir = variantDirOf(sketch, variant);
  const { parts, problems } = partFilesOf(dir);

  if (problems.length > 0) return problems.map((problem) => `${problem.file}: ${problem.message}`).join('\n');

  const shared = sharedPlanOf({ sketch, variant, parts, product });

  if (typeof shared === 'string') return shared;

  const fixtures = fixturesOf(dir);

  if (!sketch.baseline)
    return {
      reason: `${sketch.target} records no baseline of the product - compare each variant with the product, then run sketch rebase ${sketch.target}`,
      changed: [],
    };

  const conflicts = conflictsOf({ product, baseline: sketch.baseline, parts, fixtures: fixtures !== null });

  if (conflicts.length > 0)
    return {
      reason: `${conflicts.join(', ')} changed in the product since the sketch on ${sketch.target} was created - bring variant "${variant}" up to date, then run sketch rebase ${sketch.target}`,
      changed: conflicts,
    };

  const mergedKeys = [...new Set([...sketch.targets, ...parts.map(partKeyOf)])];
  const baseKeys = baseKeysOf({ product, sketch, keys: mergedKeys });
  const base = product.base;

  if (baseKeys.length > 0 && (!base || isBuiltInBase(product.config.base ?? '')))
    return `${baseKeys.join(', ')} comes from the built-in base ${product.config.base} - only a sketch opened with --override merges it, as a product copy`;

  const rootOf = (key: string) => (base && baseKeys.includes(key) ? base.dir : product.dir);
  const removedKeys = baseKeys.filter(
    (key) => product.parts.find((part) => partKeyOf(part) === key)?.origin === 'overridden',
  );
  const notedTargets: NotedTarget[] = [];

  for (const key of sketch.targets) {
    const noted = notedTargetOf({ sketch, variant, parts, product, root: rootOf(key), key, note });

    if (typeof noted === 'string') return noted;

    notedTargets.push(noted);
  }

  const inheritedKeys = notedTargets.flatMap((entry) => (entry.inherited ? [entry.key] : []));
  const assetFiles = filesBelow(resolve(dir, ASSETS_FOLDER));
  const sharedChanges = productSharedChangesOf({ sketch, variant, product });
  const untouched =
    assetFiles.length > 0 || sharedChanges.length > 0 ? unchangedMergedOf({ product, except: mergedKeys }) : [];

  const baseProduct =
    base && baseKeys.length > 0 && base.configFile === product.configFile && config.products?.[base.name]
      ? resolveProduct({ target, name: base.name, config: base.config })
      : null;
  const known = [...ruleLinesOf(target, product), ...(baseProduct ? ruleLinesOf(target, baseProduct) : [])];

  const swapped = swap([
    ...notedTargets.flatMap(({ inherited, targetDir }) =>
      inherited ? [{ from: dirname(inherited.file), to: targetDir }] : [],
    ),
    ...parts.map((part) => ({ from: dirname(part.file), to: resolve(rootOf(partKeyOf(part)), part.layer, part.name) })),
    ...removedKeys.map((key) => ({ from: null, to: resolve(product.dir, key) })),
    ...(fixtures ? [{ from: fixtures, to: resolve(product.dir, 'fixtures.ts') }] : []),
    ...assetFiles.map((file) => ({
      from: file,
      to: resolve(product.dir, ASSETS_FOLDER, relative(resolve(dir, ASSETS_FOLDER), file)),
    })),
    ...sharedChanges,
  ]);

  for (const { noteFile, noted } of notedTargets) writeFileSync(noteFile, noted);

  for (const { targetDir, paths } of shared.carry) {
    const key = relative(product.dir, targetDir);

    carryShared({ sketch, variant, targetDir: resolve(rootOf(key), key), paths, product });
  }

  const checked = [product.name, ...(baseProduct ? [baseProduct.name] : [])];

  if (checkSystem({ target, config, products: checked, known }) !== 0) {
    swapped.restore();

    return `the check failed after the merge of ${sketch.target} variant "${variant}" - the product's old files are back, the sketch stays`;
  }

  const written = [
    ...mergedKeys.flatMap((key) => filesBelow(resolve(rootOf(key), key))),
    ...sharedChanges.map(({ to }) => to),
    ...(fixtures ? [resolve(product.dir, 'fixtures.ts')] : []),
    ...assetFiles.map((file) => resolve(product.dir, ASSETS_FOLDER, relative(resolve(dir, ASSETS_FOLDER), file))),
  ];
  formatFiles(target, [...new Set(written)]);

  swapped.drop();
  const productKeys = mergedKeys.filter((key) => !baseKeys.includes(key));

  if (productKeys.length > 0) recordMerged({ product, parts: productKeys });

  if (base && baseKeys.length > 0) {
    recordMerged({ product: { dir: base.dir, base: null }, parts: baseKeys });
    forgetMerged({ productDir: product.dir, parts: removedKeys });
  }

  const alsoChanged = rerecordChangedMerged({ product, before: untouched });

  if (alsoChanged.length > 0) console.log(`Asset or shared/ change also updates: ${alsoChanged.join(', ')}`);

  resolveSketchEndComments({
    sketch,
    parts: mergedKeys,
    note: `resolved by the merge of ${sketch.target} variant ${variant}`,
  });
  addressSketchComments({ sketch, reason: 'merge', author, note });
  rmSync(sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: target, sketch });

  return [...new Set([...inheritedKeys, ...parts.map(partKeyOf)])];
};

/**
 * Merges the variant the user picked in a ready sketch into the product: copies each part it holds
 * over the product's - a part the product takes from its base over the base's, unless the sketch was opened with
 * `override`; `into-base` also removes the product copy and its `merged.json` entry - sets `note` (when given) and `madeBy` (the file's own plus the variant's authors) on the target, runs the check
 * records each merged part's hash in `merged.json` and deletes the sketch. With `override`, a target the product only takes from its base is copied into the product first. When the check fails, the
 * product's old files come back and the sketch stays. Each file in the variant's `assets/` goes into the product's `assets/`. A file of the sketch's `shared/` folder whose path the product's `shared/` holds
 * replaces it there; the rest goes into the target's folder when the target imports it, with its `@shared/` imports made relative; any other part that imports it stops the merge. Otherwise the addressed comments on its variants, and those on the merged parts that have no sketch, are resolved, and the open ones on its variants are addressed, by `author` or the user. Refuses without a
 * pick, and when a part the variant replaces changed in the product since the sketch's baseline. Answers with the merged part keys, or with why nothing was merged - and, when a rebase
 * would let it, the parts that changed (`[]` without a baseline).
 */
export const mergeSketch = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  note?: string;
  author?: string;
}): string[] | MergeRefusal => {
  const merged = mergeOrReason(options);

  return typeof merged === 'string' ? { reason: merged } : merged;
};

/** Deletes a sketch with all its variants and resolves the addressed comments on them and marks the open ones addressed, by `author` or the user. */
export const discardSketch = (options: { target: string; sketch: Sketch; author?: string }): string | null => {
  resolveSketchEndComments({
    sketch: options.sketch,
    note: `resolved by the discard of ${options.sketch.target}`,
  });
  addressSketchComments({ sketch: options.sketch, reason: 'discard', author: options.author });
  rmSync(options.sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: options.target, sketch: options.sketch });

  return null;
};
