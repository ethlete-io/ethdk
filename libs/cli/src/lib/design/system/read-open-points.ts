import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { MessagePort, Worker } from 'worker_threads';
import { packageFileOf } from '../package-root';
import { listComments } from './comments/comment';
import { CompletenessGap, isMissingStateGap } from './complete';
import {
  OpenPoint,
  openPointsOf,
  OpenPointsInput,
  PartOpenPoints,
  sketchAddedPointsOf,
  SKETCH_KINDS,
} from './open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import {
  declaresControlsOf,
  declaresNoControlsOf,
  instantOf,
  motionRefsOf,
  partLinkOf,
  stateNamesOf,
  unreachableOf,
} from './sketch/part-definition';
import { directEditsOf } from './sketch/merged-parts';
import { variantProblemsOf } from './sketch/check-sketches';
import { overlaySketch } from './sketch/overlay';
import { prefetchClassFactsOf } from './rules/tailwind-classes';
import { listSketches, Sketch } from './sketch/sketch';
import { ruleProblemsOf } from './check-system';
import { Problem } from './problem';
import { allHeldEdits, HeldEdits } from './sketch/held-edits';
import { PoolWorkerData, startSyncPool } from './sync-pool';
import { inputsUnchanged, PrintedInput, recordInputs, trackedRun } from './tracked-reads';

const isPair = <T extends { from: string | null; to: string | null }>(
  pair: T,
): pair is T & { from: string; to: string } => pair.from !== null && pair.to !== null;

const motionOf = (source: string): Pick<OpenPointsInput['parts'][number], 'motion'> => {
  const states = stateNamesOf(source);

  if (!states) return {};

  return {
    motion: {
      states,
      motions: motionRefsOf(source).motions.filter(isPair),
      unreachable: (unreachableOf(source) ?? []).filter((pair) => !!pair.reason?.trim()).filter(isPair),
      instant: instantOf(source).kind === 'declared',
    },
  };
};

const partInputsOf = (product: ResolvedProduct): OpenPointsInput['parts'] =>
  product.parts.map((part) => ({
    key: partKeyOf(part),
    layer: part.layer,
    controls: declaresControlsOf(part.source),
    declaredNoControls: declaresNoControlsOf(part.source),
    ...motionOf(part.source),
  }));

/** A content print of a resolved product, which holds the source of every part. */
export const productPrintOf = (product: ResolvedProduct) =>
  createHash('sha1').update(JSON.stringify(product)).digest('base64url');

/** The rule problems of a product with the files their run read; the run happens on the first call. */
export type ProductRuleRun = () => { value: Problem[]; inputs: PrintedInput[] };

export const productRuleRunOf = (product: ResolvedProduct): ProductRuleRun => {
  let run: ReturnType<ProductRuleRun> | null = null;

  return () => (run ??= trackedRun(() => ruleProblemsOf(product)));
};

type HeldVariantProblems = { print: string; inputs: PrintedInput[]; problems: Problem[] };

const heldVariantProblems = new Map<string, HeldVariantProblems>();

type VariantRun = { sketch: Sketch; variant: string; slot: string; print: string; held: HeldVariantProblems | null };

const variantRunOf = ({
  product,
  productPrint,
  sketch,
  variant,
}: {
  product: ResolvedProduct;
  productPrint: string;
  sketch: Sketch;
  variant: string;
}): VariantRun => {
  const slot = JSON.stringify([product.dir, sketch.target, sketch.name, variant]);
  const print = createHash('sha1').update(productPrint).update(JSON.stringify(sketch)).digest('base64url');
  const held = heldVariantProblems.get(slot);

  return {
    sketch,
    variant,
    slot,
    print,
    held: held && held.print === print && inputsUnchanged(held.inputs) ? held : null,
  };
};

/** One variant of a ready sketch to lay over the product and run the rules on, as data a pool worker can take. */
export type VariantJob = {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  productProblems: Problem[];
  held: HeldEdits;
};

/** The rule problems a variant adds over the product, with the files the run read. */
export const variantAnswerOf = ({ product, sketch, variant, productProblems }: VariantJob) =>
  trackedRun(
    () =>
      variantProblemsOf({ product, sketch: { ...sketch, variants: [variant] }, productProblems })[0]?.problems ?? [],
  );

type VariantAnswer = ReturnType<typeof variantAnswerOf>;

let variantPoolSize = 0;

/** Runs the fresh variants of the ready sketches in up to `size` workers; 0 runs them on the calling thread. */
export const useVariantPool = (size: number) => {
  variantPoolSize = size;
};

const startVariantWorker = (workerData: PoolWorkerData, transferList: MessagePort[]) => {
  const built = packageFileOf(resolve(__dirname, 'variant-pool-worker.js'));

  return existsSync(built)
    ? new Worker(built, { workerData, transferList })
    : new Worker(resolve(__dirname, 'variant-pool-worker.ts'), {
        workerData,
        transferList,
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

const freshVariantAnswersOf = ({
  product,
  productRules,
  fresh,
}: {
  product: ResolvedProduct;
  productRules: ProductRuleRun;
  fresh: VariantRun[];
}): VariantAnswer[] => {
  const size = Math.min(variantPoolSize, fresh.length);
  const pool = size > 1 ? startSyncPool<VariantJob, VariantAnswer>({ size, start: startVariantWorker }) : null;

  try {
    prefetchClassFactsOf([product, ...fresh.map(({ sketch, variant }) => overlaySketch({ product, sketch, variant }))]);

    const productProblems = productRules().value;
    const jobs = fresh.map(({ sketch, variant }) => ({
      product,
      sketch,
      variant,
      productProblems,
      held: allHeldEdits(),
    }));

    try {
      if (pool) return pool.run(jobs);
    } catch {
      return jobs.map(variantAnswerOf);
    }

    return jobs.map(variantAnswerOf);
  } finally {
    pool?.stop();
  }
};

const sketchProblemsOf = ({
  product,
  sketches,
  productRules,
}: {
  product: ResolvedProduct;
  sketches: Sketch[];
  productRules: ProductRuleRun;
}): OpenPointsInput['sketchProblems'] => {
  const ready = sketches.filter((sketch) => sketch.status === 'ready' && sketch.decision?.kind !== 'discard');

  if (ready.length === 0) return [];

  const productPrint = productPrintOf(product);
  const runs = ready.flatMap((sketch) =>
    sketch.variants.map((variant) => variantRunOf({ product, productPrint, sketch, variant })),
  );
  const fresh = runs.filter((run) => !run.held);

  if (fresh.length > 0) {
    const answers = freshVariantAnswersOf({ product, productRules, fresh });
    const productInputs = productRules().inputs;

    fresh.forEach((run, index) => {
      const answer = answers[index] ?? { value: [], inputs: [] };

      run.held = { print: run.print, inputs: [...answer.inputs, ...productInputs], problems: answer.value };
      heldVariantProblems.set(run.slot, run.held);
    });
  }

  const seen = new Set<string>();

  return runs.flatMap((run) => {
    recordInputs(run.held?.inputs ?? []);

    return (run.held?.problems ?? []).flatMap(({ rule, message }) => {
      const key = `${run.sketch.target}\n${run.variant}\n${rule}\n${message}`;

      if (seen.has(key)) return [];

      seen.add(key);

      return [{ part: run.sketch.target, sketch: run.sketch.name, variant: run.variant, rule, message }];
    });
  });
};

/**
 * The open points of every part of a product, read from its part files, comments and sketches, plus the
 * `rendered` findings of a check that drew the parts. `sketchProblems` adds the static rule problems of each variant of
 * a ready sketch, which lays every such variant over the product and runs the rules; each variant keeps its problems
 * while the product resolves the same and every file its run read still reads the same. `productRules` shares the rule
 * run of the product with the caller.
 */
export const readOpenPoints = (
  product: ResolvedProduct,
  {
    sketchProblems = false,
    productRules = productRuleRunOf(product),
    ...rendered
  }: Pick<OpenPointsInput, 'missingStates' | 'busyStates'> & {
    sketchProblems?: boolean;
    productRules?: ProductRuleRun;
  } = {},
): PartOpenPoints[] => {
  const source = { productDir: product.dir, product: product.name };
  const directEdits = directEditsOf(product);
  const editSketches = new Set(directEdits.flatMap(({ sketch }) => (sketch ? [sketch] : [])));
  const sketches = listSketches(source).filter(
    (sketch): sketch is Sketch => typeof sketch !== 'string' && !editSketches.has(sketch.target),
  );

  return openPointsOf({
    parts: partInputsOf(product),
    comments: listComments({ ...source, all: true }).comments.map((comment) => ({
      id: comment.id,
      part: comment.part,
      state: comment.state,
      answered: comment.addressed !== undefined,
      resolved: comment.resolved !== undefined,
    })),
    sketches: sketches.map((sketch) => ({
      name: sketch.name,
      target: sketch.target,
      targets: sketch.targets,
      status: sketch.status,
      decision: sketch.decision?.kind ?? null,
    })),
    sketchProblems: sketchProblems ? sketchProblemsOf({ product, sketches, productRules }) : [],
    directEdits,
    ...rendered,
  });
};

/** The points of one part, or none when it has no open point. */
export const partPointsOf = (list: PartOpenPoints[], part: string): OpenPoint[] =>
  list.find((entry) => entry.part === part)?.points ?? [];

/** The controls of each part that lack a drawn state, from the gaps of a completeness check. */
export const missingStatesOf = (
  gaps: Map<string, CompletenessGap[] | string>,
): NonNullable<OpenPointsInput['missingStates']> =>
  [...gaps].flatMap(([part, found]) =>
    typeof found === 'string'
      ? []
      : [...new Set(found.filter(isMissingStateGap).map((gap) => gap.target.slice(part.length + 1)))].map(
          (control) => ({ part, control }),
        ),
  );

/**
 * The open points of `targets` as a sketch variant draws them, of the kinds the sketch closes itself, split into the
 * ones the variant adds to the merged parts and the ones it inherits from them. `busy` names the drawn states of each
 * side whose render shows ongoing work.
 */
export const sketchOpenPointsOf = ({
  merged,
  variant,
  targets,
  busy = { merged: [], variant: [] },
}: {
  merged: ResolvedProduct;
  variant: ResolvedProduct;
  targets: string[];
  busy?: Record<'merged' | 'variant', NonNullable<OpenPointsInput['busyStates']>>;
}): { added: PartOpenPoints[]; inherited: PartOpenPoints[] } => {
  const ownOf = (product: ResolvedProduct, busyStates: NonNullable<OpenPointsInput['busyStates']>) =>
    openPointsOf({
      parts: partInputsOf(product).filter((part) => targets.includes(part.key)),
      comments: [],
      sketches: [],
      busyStates,
    }).flatMap(({ part, points }) => {
      const own = points.filter((point) => SKETCH_KINDS.includes(point.kind));

      return own.length > 0 ? [{ part, points: own }] : [];
    });

  return sketchAddedPointsOf(ownOf(merged, busy.merged), ownOf(variant, busy.variant));
};

/** The own parts outside `foundations/` that have no `implements` link; parts from the base product are left out. */
export const unlinkedPartsOf = (product: ResolvedProduct): string[] =>
  product.parts
    .filter((part) => part.origin !== 'base' && part.layer !== 'foundations' && partLinkOf(part.source).kind === 'none')
    .map(partKeyOf);

/** One line per part of `targets` that declares instant state switches, with its reason. */
export const instantLinesOf = (product: ResolvedProduct, targets: string[]): string[] =>
  product.parts
    .filter((part) => targets.includes(partKeyOf(part)))
    .flatMap((part) => {
      const instant = instantOf(part.source);

      return instant.kind === 'declared'
        ? [`${partKeyOf(part)} declares instant state switches (no motion between its states): ${instant.reason}`]
        : [];
    });
