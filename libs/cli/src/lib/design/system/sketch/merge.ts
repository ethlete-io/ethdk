import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { DesignConfig } from '../../paths';
import { checkSystem, ruleLinesOf } from '../check-system';
import { addressSketchComments } from '../comments/comment';
import { ASSETS_FOLDER, filesBelow } from '../assets';
import { fixturesOf, partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { conflictsOf } from './baseline';
import { carryShared, sharedPlanOf } from './merge-shared';
import { recordMerged, rerecordChangedMerged, unchangedMergedOf } from './merged-parts';
import { madeByOf, withMadeBy, withNote } from './part-definition';
import { authorsOf, clearSketchReport, Sketch, variantDirOf } from './sketch';

const swap = (entries: { from: string; to: string }[]) => {
  const backup = mkdtempSync(join(tmpdir(), 'ethlete-sketch-merge-'));
  const held = entries.map(({ to }, index) => {
    const copy = resolve(backup, String(index));

    if (existsSync(to)) cpSync(to, copy, { recursive: true });

    return { to, copy: existsSync(copy) ? copy : null };
  });

  for (const { from, to } of entries) {
    rmSync(to, { recursive: true, force: true });
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

/** Why a merge did nothing; `changed` names the parts a rebase must take in, `[]` when the sketch records no baseline. */
export type MergeRefusal = { reason: string; changed?: string[] };

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
  const dir = variantDirOf(sketch, variant);
  const { parts, problems } = partFilesOf(dir);

  if (problems.length > 0) return problems.map((problem) => `${problem.file}: ${problem.message}`).join('\n');

  const shared = sharedPlanOf({ sketch, parts });

  if (shared !== 'carry' && shared !== 'drop') return shared;

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

  const targetDir = resolve(product.dir, sketch.layer, sketch.name);
  const noteFile = resolve(targetDir, `${sketch.name}.ts`);
  const carried = parts.find((part) => partKeyOf(part) === sketch.target)?.file;
  const inherited =
    carried || existsSync(noteFile) ? null : product.parts.find((part) => partKeyOf(part) === sketch.target);
  const held = carried ?? (inherited ? inherited.file : noteFile);

  if (!existsSync(held))
    return `variant "${variant}" holds no ${sketch.target}, and the product has no ${sketch.target} to carry the note`;

  const source = readFileSync(held, 'utf8');
  const withNewNote = note?.trim() ? withNote(source, note.trim()) : source;
  const madeBy = [...new Set([...madeByOf(source), ...authorsOf(sketch, variant)])];
  const noted = withNewNote === null || madeBy.length === 0 ? withNewNote : withMadeBy(withNewNote, madeBy);

  if (noted === null) return `${held} holds no definePart({ note: '…' }) to set the note on`;

  const mergedKeys = [...new Set([sketch.target, ...parts.map(partKeyOf)])];
  const assetFiles = filesBelow(resolve(dir, ASSETS_FOLDER));
  const untouched = assetFiles.length > 0 ? unchangedMergedOf({ product, except: mergedKeys }) : [];

  const known = ruleLinesOf(target, product);

  const swapped = swap([
    ...(inherited ? [{ from: dirname(inherited.file), to: targetDir }] : []),
    ...parts.map((part) => ({ from: dirname(part.file), to: resolve(product.dir, part.layer, part.name) })),
    ...(fixtures ? [{ from: fixtures, to: resolve(product.dir, 'fixtures.ts') }] : []),
    ...assetFiles.map((file) => ({
      from: file,
      to: resolve(product.dir, ASSETS_FOLDER, relative(resolve(dir, ASSETS_FOLDER), file)),
    })),
  ]);

  writeFileSync(noteFile, noted);

  if (shared === 'carry') carryShared({ sketch, variant, targetDir });

  if (checkSystem({ target, config, products: [product.name], known }) !== 0) {
    swapped.restore();

    return `the check failed after the merge of ${sketch.target} variant "${variant}" - the product's old files are back, the sketch stays`;
  }

  swapped.drop();
  recordMerged({ product, parts: mergedKeys });

  const alsoChanged = rerecordChangedMerged({ product, before: untouched });

  if (alsoChanged.length > 0) console.log(`Asset change also updates: ${alsoChanged.join(', ')}`);

  addressSketchComments({ sketch, reason: 'merge', author, note });
  rmSync(sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: target, sketch });

  return [...(inherited ? [sketch.target] : []), ...parts.map(partKeyOf)];
};

/**
 * Merges the variant the user picked in a ready sketch into the product: copies each part it holds
 * over the product's, sets `note` (when given) and `madeBy` (the file's own plus the variant's authors) on the target, runs the check
 * records each merged part's hash in `merged.json` and deletes the sketch. A target the product only takes from its base is copied into the product first. When the check fails, the
 * product's old files come back and the sketch stays. Each file in the variant's `assets/` goes into the product's `assets/`. The sketch's `shared/` folder goes into the target's folder when the
 * target imports it, with its `@shared/` imports made relative; any other part that imports it stops the merge. Otherwise the open comments on its variants are addressed, by `author` or the user. Refuses without a
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

/** Deletes a sketch with all its variants and marks the open comments on them addressed, by `author` or the user. */
export const discardSketch = (options: { target: string; sketch: Sketch; author?: string }): string | null => {
  addressSketchComments({ sketch: options.sketch, reason: 'discard', author: options.author });
  rmSync(options.sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: options.target, sketch: options.sketch });

  return null;
};
