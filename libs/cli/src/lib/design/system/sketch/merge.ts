import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { DesignConfig } from '../../paths';
import { checkSystem } from '../check-system';
import { commentsOnSketch } from '../comments/comment';
import { fixturesOf, partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { withNote } from './part-definition';
import { clearSketchReport, Sketch, variantDirOf } from './sketch';

const openCommentsProblemOf = (sketch: Sketch) => {
  const open = commentsOnSketch({
    productDir: resolve(sketch.dir, '..', '..'),
    product: sketch.product,
    sketch: sketch.target,
  });

  return open.length > 0
    ? `${sketch.target} has ${open.length} open comment(s) - handle them and run inbox done first: ${open.map((comment) => comment.id).join(', ')}`
    : null;
};

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

/**
 * Merges the picked variant of a ready sketch into the product: copies each part it holds over the
 * product's, sets `note` on the target, runs the check and deletes the sketch. When the check fails,
 * the product's old files come back and the sketch stays. Refuses while the sketch has open comments.
 * Answers with the merged part keys, or with why nothing was merged.
 */
export const mergeSketch = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  note: string;
}): string[] | string => {
  const { target, config, product, sketch, variant, note } = options;

  if (!sketch.variants.includes(variant))
    return `${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ') || 'none'}`;
  if (sketch.status !== 'ready') return `${sketch.target} is ${sketch.status} - mark it ready before a merge`;
  if (note.trim() === '') return 'a merge needs --note with the reason for the new shape';

  const open = openCommentsProblemOf(sketch);

  if (open) return open;

  const dir = variantDirOf(sketch, variant);
  const { parts, problems } = partFilesOf(dir);

  if (problems.length > 0) return problems.map((problem) => `${problem.file}: ${problem.message}`).join('\n');

  const noteFile = resolve(product.dir, sketch.layer, sketch.name, `${sketch.name}.ts`);
  const held = parts.find((part) => partKeyOf(part) === sketch.target)?.file ?? noteFile;

  if (!existsSync(held))
    return `variant "${variant}" holds no ${sketch.target}, and the product has no own ${sketch.target} to carry the note`;

  const noted = withNote(readFileSync(held, 'utf8'), note);

  if (noted === null) return `${held} holds no definePart({ note: '…' }) to set the note on`;

  const fixtures = fixturesOf(dir);
  const swapped = swap([
    ...parts.map((part) => ({ from: dirname(part.file), to: resolve(product.dir, part.layer, part.name) })),
    ...(fixtures ? [{ from: fixtures, to: resolve(product.dir, 'fixtures.ts') }] : []),
  ]);

  writeFileSync(noteFile, noted);

  if (checkSystem({ target, config, products: [product.name] }) !== 0) {
    swapped.restore();

    return `the check failed after the merge of ${sketch.target} variant "${variant}" - the product's old files are back, the sketch stays`;
  }

  swapped.drop();
  rmSync(sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: target, sketch });

  return parts.map(partKeyOf);
};

/** Deletes a sketch with all its variants. Refuses while it has open comments. */
export const discardSketch = (options: { target: string; sketch: Sketch }): string | null => {
  const open = openCommentsProblemOf(options.sketch);

  if (open) return open;

  rmSync(options.sketch.dir, { recursive: true, force: true });
  clearSketchReport({ checkout: options.target, sketch: options.sketch });

  return null;
};
