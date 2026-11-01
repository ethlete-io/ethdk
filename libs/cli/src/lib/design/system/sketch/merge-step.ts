import { DesignConfig } from '../../paths';
import { DesignStep } from '../tom-confirm';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { configOf, oneProductOf } from './cli-args';
import { mergeSketch } from './merge';
import { recordMergeReason } from './merged-parts';
import { decideSketch, findSketch, parseTarget, rejectionOf, Sketch } from './sketch';

/** The sketch with the pick a plan allows: its only live variant, when `variant` names it and nobody picked yet. */
export const allowedMergeOf = (options: { sketch: Sketch; variant: string }) => {
  const { sketch, variant } = options;
  const live = sketch.variants.filter((candidate) => !rejectionOf(sketch, candidate));

  if (live.length !== 1 || live[0] !== variant)
    return `${sketch.target} has ${live.length} live variants (${live.join(', ') || 'none'}), not only "${variant}" - the user picks in Studio`;

  return decideSketch({ sketch, decision: { kind: 'pick', variant } });
};

/** Merges the picked variant of `sketch` and logs the reason; answers the merged variant and part keys, or why not. */
export const mergeAndRecord = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  note?: string;
  replaceNote?: boolean;
  by?: string;
  allowed?: { variant: string; planRef: string };
}): { variant: string; parts: string[] } | string => {
  const { target, config, product, sketch, note, replaceNote, by, allowed } = options;
  const decided = allowed ? allowedMergeOf({ sketch, variant: allowed.variant }) : sketch;

  if (typeof decided === 'string') return decided;

  const result = mergeSketch({ target, config, product, sketch: decided, note, replaceNote, author: by });

  if (!Array.isArray(result)) return result.reason;

  const reason = note?.trim() || undefined;

  if (allowed || reason)
    for (const part of sketch.targets)
      recordMergeReason({ product, part, by: by ?? 'user', planRef: allowed?.planRef.trim(), reason });

  return { variant: decided.decision?.kind === 'pick' ? decided.decision.variant : '', parts: result };
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

  const picked = sketch.decision?.kind === 'pick' ? sketch.decision.variant : undefined;
  const allowed = variant !== undefined && picked === undefined ? { variant, planRef: note } : undefined;

  if (variant !== undefined && picked !== undefined && picked !== variant)
    return `${sketch.target} was picked as variant "${picked}", not "${variant}"`;

  if (allowed) {
    const decided = allowedMergeOf({ sketch, variant: allowed.variant });

    if (typeof decided === 'string') return decided;
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
