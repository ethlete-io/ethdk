import { DesignConfig } from '../../design-config';
import { timedPhase } from '../../phase-timing';
import { decisionRefsOf } from '../decision-refs';
import { refreshHarnessMap } from '../harness-map';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { configOf, isModelId, oneProductOf } from './cli-args';
import { commitMergeResultSync, dirtyFilesOfSync } from './merge-commit';
import { mergeSketch, MergeRefusal, rebaseOthersAfterMerge } from './merge';
import { openJournal } from '../write-journal';
import { appGatedMergeOf } from './merge-app-gate';
import { recordMergeReason } from './merged-parts';
import { originOf } from '../write-origin';
import { decideSketch, findSketch, parseTarget, rejectionOf, Sketch, writeSketchFile } from './sketch';

export type DesignStep = { line: string; run: () => Promise<number> };

/** The sketch with the pick a plan allows: its only live variant, when `variant` names it and nobody picked yet. */
export const allowedMergeOf = (options: { sketch: Sketch; variant: string; by?: string; editRef?: boolean }) => {
  const { sketch, variant, by = '', editRef } = options;
  const live = sketch.variants.filter((candidate) => !rejectionOf(sketch, candidate));

  if (editRef ? !live.includes(variant) : live.length !== 1 || live[0] !== variant)
    return `${sketch.target} has ${live.length} live variants (${live.join(', ') || 'none'}), not only "${variant}" - the user picks in Studio`;

  return decideSketch({ sketch, decision: { kind: 'pick', variant, ...originOf(by) } });
};

/** The variant a person picked; a pick an agent wrote with `merge --allowed-by` counts as no pick. */
export const humanPickOf = (sketch: Sketch) =>
  sketch.decision?.kind === 'pick' && !isModelId(sketch.decision.by ?? '') ? sketch.decision.variant : undefined;

const withoutAgentPickOf = (sketch: Sketch): Sketch =>
  sketch.decision?.kind === 'pick' && humanPickOf(sketch) === undefined ? { ...sketch, decision: undefined } : sketch;

export const editRefOf = (options: { target: string; sketch: Sketch; planRef: string }) =>
  options.sketch.target.endsWith('@edit') &&
  decisionRefsOf({ target: options.target, text: options.planRef }).length > 0;

/** Merges the picked variant of `sketch` and logs the reason; answers the merged variant and part keys, or why not. */
export const mergeAndRecord = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  note?: string;
  replaceNote?: boolean;
  by?: string;
  decidedBy?: string;
  allowed?: { variant: string; planRef: string; editRef?: boolean };
}): { variant: string; parts: string[] } | string => {
  const { target, config, product, sketch, note, replaceNote, by, decidedBy, allowed } = options;
  const own = withoutAgentPickOf(sketch);
  const decided = allowed
    ? allowedMergeOf({ sketch: own, variant: allowed.variant, by, editRef: allowed.editRef })
    : own;

  if (typeof decided === 'string') return decided;

  const variant = decided.decision?.kind === 'pick' ? decided.decision.variant : '';
  const reason = note?.trim() || undefined;
  const result = timedPhase('merge-files', () =>
    journaledMergeOf({
      target,
      product,
      sketch: decided,
      merge: () =>
        mergeSketch({
          target,
          config,
          product,
          sketch: decided,
          note,
          replaceNote,
          author: by,
          deferRebase: true,
          ...(allowed ? { decidedBy: `plan: ${allowed.planRef.trim()}` } : decidedBy ? { decidedBy } : {}),
        }),
      finish: (before) => {
        const refreshed = timedPhase('harness-map', () => refreshHarnessMap({ target, product }));

        if (typeof refreshed === 'string') console.error(`merged, but the harness map is still stale: ${refreshed}`);

        if (allowed || reason)
          for (const part of sketch.targets)
            recordMergeReason({ product, part, planRef: allowed?.planRef.trim(), reason });

        commitMergeResultSync({ target, product, sketch, variant, before });
      },
    }),
  );

  if (!Array.isArray(result)) {
    if (allowed) writeSketchFile(sketch);

    return result.reason;
  }

  return { variant, parts: result };
};

/**
 * Runs `merge` behind the app gate and then `finish` (the writes that complete it, up to its commit) as one journaled
 * step: a refusal or a throw undoes every file it wrote, and the next process that takes the product lock undoes a
 * killed one, or finishes it once its commit landed. Then rebases the other sketches the merge made stale.
 */
export const journaledMergeOf = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  merge: () => string[] | MergeRefusal;
  finish: (before: Map<string, string> | null) => void;
}): string[] | MergeRefusal => {
  const { target, product, sketch } = options;
  const before = dirtyFilesOfSync({ target, product });
  const journal = openJournal({ productDir: product.dir, root: target, label: `merge of ${sketch.target}` });

  try {
    const merged = appGatedMergeOf({ target, product, sketch, merge: options.merge });

    if (!Array.isArray(merged)) {
      journal.rollback();

      return merged;
    }

    options.finish(before);
    journal.close();

    rebaseOthersAfterMerge({ target, product, sketch }).forEach((line) => console.log(line));

    return merged;
  } catch (error) {
    journal.rollback();

    throw error;
  }
};

/** A merge of one ready sketch as a step, or why it may not run; checks everything a merge needs before anything is written. */
export const mergeStepOf = (options: {
  target: string;
  product: string | undefined;
  part: string;
  variant?: string;
  note: string;
  by: string;
}): DesignStep | string => {
  const { target, by, variant } = options;
  const note = options.note.trim();
  const config = configOf(target);
  const parsed = parseTarget(options.part);

  if (typeof config === 'string') return config;
  if (typeof parsed === 'string') return parsed;

  const product = oneProductOf({ target, config, asked: options.product });

  if (typeof product === 'string') return product;

  const part = partKeyOf(parsed);
  const sketch = findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

  if (sketch === null) return `no sketch on ${part} in ${product.name}`;
  if (typeof sketch === 'string') return sketch;
  if (sketch.status !== 'ready')
    return `${sketch.target} is ${sketch.status} - mark it ready first: design sketch ready ${sketch.target} --by <model id> --product ${product.name}`;

  const picked = humanPickOf(sketch);
  const allowed =
    variant !== undefined && picked === undefined
      ? { variant, planRef: note, editRef: editRefOf({ target, sketch, planRef: note }) }
      : undefined;

  if (variant !== undefined && picked !== undefined && picked !== variant)
    return `${sketch.target} was picked as variant "${picked}", not "${variant}"`;

  if (allowed) {
    const decided = allowedMergeOf({
      sketch: withoutAgentPickOf(sketch),
      variant: allowed.variant,
      by,
      editRef: allowed.editRef,
    });

    if (typeof decided === 'string') return decided;

    writeSketchFile(sketch);
  } else if (picked === undefined)
    return `${sketch.target} has no pick - name the variant in the entry, or the user picks in Studio`;

  return {
    line: `merge ${product.name} ${part}${variant ? ` variant ${variant}` : ''} - ${note}`,
    run: async () => {
      const merged = mergeAndRecord({ target, config, product, sketch, note, by, allowed });

      if (typeof merged === 'string') {
        console.error(merged);

        return 1;
      }

      console.log(`merged ${sketch.target} variant ${merged.variant} into ${product.name}: ${merged.parts.join(', ')}`);

      return 0;
    },
  };
};
