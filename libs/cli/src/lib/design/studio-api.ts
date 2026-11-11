import { execFileSync } from 'child_process';
import { originOf } from './system/write-origin';
import { IncomingMessage } from 'http';
import { relative } from 'path';
import { fromEvent, take } from 'rxjs';
import { setImmediate } from 'timers/promises';
import { repoInvocation } from '../invocation';
import { DesignConfig, readConfig } from './design-config';
import {
  CommentSize,
  createComment,
  deleteComment,
  DesignComment,
  isOpenComment,
  listComments,
  replyToComment,
  resolveComment,
  threadStateOf,
  staleReasonOf,
} from './system/comments/comment';
import { addFlowNote, changeFlowNote, deleteFlowNote, FlowNote, FlowNoteChange, listFlows } from './system/flows/flow';
import {
  changeNote,
  createNote,
  deleteNote,
  DesignNote,
  listNotes,
  NoteChange,
  noteProblemOf,
} from './system/notes/note';
import { approveException, listExceptions } from './system/exceptions';
import { approveInventory, Inventory } from './system/inventory';
import { drawnFindingsOf } from './system/drawn-open-points';
import { openPointsInWorker } from './system/open-points-runner';
import { flowProblemsOf } from './system/rules/flow';
import { Problem } from './system/problem';
import { ResolvedProduct } from './system/resolve-product';
import { openSketchListingOf } from './system/sketch/check-sketches';
import { CheckSketches } from './system/sketch/sketch-checker';
import { oneProductOf } from './system/sketch/cli-args';
import { retriedHeldMerges } from './sketch-command';
import { discardSketch, mergeRefusalOf } from './system/sketch/merge';
import { mergeInWorker } from './system/sketch/merge-runner';
import { DrawStates } from './system/accepted-pictures';
import { readPartModule } from './system/list-system';
import { compareMerge, PictureOf } from './merge-compare';
import { BoxOf, changedAreaOf, diffVariant } from './variant-diff';
import { mergePreviewOf } from './system/sketch/merge-preview';
import { overlaySketch } from './system/sketch/overlay';
import {
  decideSketch,
  findSketch,
  SketchDecisionInput,
  listSketches,
  listSketchesInTurns,
  parseTarget,
  readSketchReport,
  rejectionOf,
  Sketch,
  variantDirOf,
} from './system/sketch/sketch';
import { noChangedStateLinesOf } from './system/sketch/no-visible-change';
import { partKeyOf } from './system/resolve-product';
import { keptUnchangedStatesOf, unchangedStatesOf } from './system/sketch/unchanged-states';
import { SketchVariant } from './system/system-modules';

export const SKETCHES_PATH = '/__design/sketches';
export const SKETCH_PREVIEW_PATH = '/__design/sketch-preview';
export const SKETCH_COMPARE_PATH = '/__design/sketch-compare';
export const SKETCH_DIFF_PATH = '/__design/sketch-diff';
export const SKETCH_CROP_PATH = '/__design/sketch-crop';
export const SKETCH_DECISION_PATH = '/__design/sketch-decision';
export const SKETCH_MERGE_PATH = '/__design/sketch-merge';

const SKETCH_DECISION_KINDS: readonly SketchDecisionInput['kind'][] = ['pick', 'discard', 'reject', 'reason', 'reopen'];
export const SKETCH_DISCARD_PATH = '/__design/sketch-discard';
export const COMMENTS_PATH = '/__design/comments';
export const COMMENT_PATH = '/__design/comment';
export const COMMENT_DONE_PATH = '/__design/comment-done';
export const COMMENT_WITHDRAW_PATH = '/__design/comment-withdraw';
export const COMMENT_REPLY_PATH = '/__design/comment-reply';
export const COMMENT_EVENTS_PATH = '/__design/comment-events';
export const FLOWS_PATH = '/__design/flows';
export const NOTES_PATH = '/__design/notes';
export const NOTE_PATH = '/__design/note';
export const NOTE_CHANGE_PATH = '/__design/note-change';
export const NOTE_DELETE_PATH = '/__design/note-delete';
export const FLOW_NOTE_PATH = '/__design/flow-note';
export const FLOW_NOTE_CHANGE_PATH = '/__design/flow-note-change';
export const FLOW_NOTE_DELETE_PATH = '/__design/flow-note-delete';
export const INVENTORY_PATH = '/__design/inventory';
export const INVENTORY_APPROVE_PATH = '/__design/inventory-approve';
export const EXCEPTIONS_PATH = '/__design/exceptions';
export const EXCEPTION_APPROVE_PATH = '/__design/exception-approve';
export const MOTION_PATH = '/__design/motion';
export const OPEN_POINTS_PATH = '/__design/open-points';

export type Answer = { status: number; body: unknown };

/** Answers with the module of a part file as one variant of a sketch draws it, or as the product does without one. */
export type VariantPartLoader = (options: {
  file: string;
  product: string;
  sketch: SketchVariant | null;
}) => Promise<unknown>;

type Asked = {
  target: string;
  url: URL;
  request: IncomingMessage;
  load?: VariantPartLoader;
  pictureOf?: PictureOf;
  boxOf?: BoxOf;
  inventoryOf?: (options: { product: ResolvedProduct; part: string }) => Promise<Inventory | string>;
  drawStates?: DrawStates;
  checkSketches?: CheckSketches;
  /** Aborts when the client closes the request before it has its answer. */
  signal?: AbortSignal;
};

const failure = (status: number, message: string): Answer => ({ status, body: { error: message } });

const refusal = (options: {
  status: number;
  reason: string;
  message: string;
  extra?: Record<string, unknown>;
}): Answer => ({
  status: options.status,
  body: { error: options.message, reason: options.reason, ...options.extra },
});

const productOf = ({ target, url }: Asked): { config: DesignConfig; product: ResolvedProduct } | Answer => {
  const asked = url.searchParams.get('product');
  const config = readConfig(target);

  if (!config) return failure(404, 'no design config');
  if (!asked) return failure(400, 'product is required');

  const product = oneProductOf({ target, config, asked });

  return typeof product === 'string' ? failure(404, product) : { config, product };
};

const isAnswer = (value: object): value is Answer => 'status' in value;

const bodyOf = async (request: IncomingMessage): Promise<Record<string, unknown> | null> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const textOf = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

type Found = { asked: Asked; config: DesignConfig; product: ResolvedProduct };

const withProduct = (method: 'GET' | 'POST', run: (found: Found) => Answer | Promise<Answer>) => (asked: Asked) => {
  if ((asked.request.method ?? 'GET') !== method) return failure(405, method === 'POST' ? 'POST only' : 'GET only');

  const found = productOf(asked);

  return isAnswer(found) ? found : run({ ...found, asked });
};

const stopping =
  <TArgs extends unknown[], TResult>(signal: AbortSignal, run: (...args: TArgs) => Promise<TResult>) =>
  async (...args: TArgs) => {
    signal.throwIfAborted();

    return run(...args);
  };

/** `asked` with its loaders refusing to start a module load or a picture once `signal` aborts. */
const stoppingOn = (asked: Asked, signal: AbortSignal | undefined): Asked => {
  if (!signal) return asked;

  const { load, pictureOf, boxOf } = asked;

  return {
    ...asked,
    ...(load ? { load: stopping(signal, load) } : {}),
    ...(pictureOf ? { pictureOf: stopping(signal, pictureOf) } : {}),
    ...(boxOf ? { boxOf: stopping(signal, boxOf) } : {}),
  };
};

const withSketch = (method: 'GET' | 'POST', run: (found: Found & { sketch: Sketch }) => Answer | Promise<Answer>) =>
  withProduct(method, (found) => {
    const parsed = parseTarget(found.asked.url.searchParams.get('sketch') ?? undefined);

    if (typeof parsed === 'string') return failure(400, parsed);

    const sketch = findSketch({ productDir: found.product.dir, product: found.product.name, sketch: parsed });

    if (sketch === null) return failure(404, `no sketch on ${parsed.layer}/${parsed.name} in ${found.product.name}`);
    if (typeof sketch === 'string') return failure(422, sketch);

    return run({ ...found, asked: stoppingOn(found.asked, found.asked.signal), sketch });
  });

const problemOf = ({ target, problem }: { target: string; problem: Problem }) => ({
  rule: problem.rule,
  file: relative(target, problem.file),
  message: problem.message,
});

const sketchOf = ({ sketch: { dir, targets, ...sketch }, target }: { sketch: Sketch; target: string }) => ({
  ...sketch,
  targetParts: targets,
  dir: relative(target, dir),
});

const commentOf = ({
  comment,
  target,
  product,
}: {
  comment: DesignComment;
  target: string;
  product: ResolvedProduct;
}) => {
  const { file, ...rest } = comment;

  return {
    ...rest,
    file: relative(target, file),
    stale: isOpenComment(comment) ? staleReasonOf({ product, comment }) : null,
    threadState: threadStateOf(comment),
  };
};

type PartFacts = { states: string[]; note: string | null };

const variantChangesOf = ({ current, drawn }: { current: PartFacts; drawn: PartFacts }) => ({
  added: drawn.states.filter((state) => !current.states.includes(state)),
  dropped: current.states.filter((state) => !drawn.states.includes(state)),
  note: drawn.note === current.note ? null : { before: current.note, after: drawn.note },
});

/** Maps `items` one after another, letting the server answer other requests before each, and stops once `signal` aborts. */
const inTurns = async <TItem, TResult>(
  { items, signal }: { items: readonly TItem[]; signal?: AbortSignal | undefined },
  run: (item: TItem) => Promise<TResult>,
) => {
  const results: TResult[] = [];

  for (const item of items) {
    await setImmediate();
    signal?.throwIfAborted();
    results.push(await run(item));
  }

  return results;
};

const keptOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  part: string;
  pictured: boolean;
  problem: unknown;
}) => {
  const unchanged = options.problem ? null : await keptUnchangedStatesOf(options);

  return unchanged ? { unchanged } : {};
};

const partTargetsOf = async ({
  product,
  sketch,
  part,
  load,
  pictureOf,
  signal,
  compare,
}: {
  product: ResolvedProduct;
  sketch: Sketch;
  part: string;
  load?: VariantPartLoader;
  pictureOf?: PictureOf;
  signal?: AbortSignal;
  compare: boolean;
}) => {
  const currentFile = product.parts.find((entry) => partKeyOf(entry) === part)?.file;
  const current =
    currentFile && load
      ? await readPartModule({
          part: { file: currentFile },
          product: product.name,
          load: () => load({ file: currentFile, product: product.name, sketch: null }),
        })
      : null;

  return inTurns({ items: sketch.variants, signal }, async (variant) => {
    const file = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;

    if (!file || !load)
      return {
        part,
        variant,
        states: [],
        interactions: [],
        ...(file ? {} : { error: `variant ${variant} has no part ${part}` }),
      };

    const { states, interactions, problem, note, ...widths } = await readPartModule({
      part: { file },
      product: product.name,
      load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
    });

    return {
      part,
      variant,
      states,
      ...('widths' in widths ? { widths: widths.widths } : {}),
      interactions,
      ...(compare
        ? {
            unchanged: problem
              ? []
              : await unchangedStatesOf({ product, sketch, variant, load, pictureOf, keepPictures: true, part }),
          }
        : await keptOf({ product, sketch, variant, part, pictured: !!pictureOf, problem })),
      ...(problem || !current || current.problem
        ? {}
        : { changes: variantChangesOf({ current, drawn: { states, note } }) }),
      ...(problem ? { error: problem } : {}),
    };
  });
};

const targetsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load?: VariantPartLoader;
  pictureOf?: PictureOf;
  signal?: AbortSignal;
  compare: boolean;
}) =>
  (
    await inTurns({ items: options.sketch.targets, signal: options.signal }, (part) =>
      partTargetsOf({ ...options, part }),
    )
  ).flat();

type ListedTarget = Awaited<ReturnType<typeof targetsOf>>[number];

const noChangedStateProblemsOf = ({ sketch, targets }: { sketch: Sketch; targets: ListedTarget[] }) => {
  const changes = sketch.variants.flatMap((variant) => {
    const drawn = targets.filter((entry) => entry.variant === variant);
    const compared = drawn.every(
      (entry) => !('error' in entry) && entry.states.length > 0 && 'unchanged' in entry && entry.unchanged,
    );

    if (rejectionOf(sketch, variant) || drawn.length === 0 || !compared) return [];

    const changed = drawn.some((entry) =>
      entry.states.some((state) => !('unchanged' in entry && entry.unchanged?.includes(state))),
    );

    return [{ variant, change: changed ? 'changed' : null }];
  });
  const unchanged = changes.filter(({ change }) => change === null);

  return noChangedStateLinesOf({ sketch, changes, noVisibleChange: sketch.status === 'ready' }).map(
    (line, index): Problem & { variant: string } => {
      const variant = unchanged[index]?.variant ?? '';

      return {
        variant,
        rule: 'NO-CHANGED-STATE',
        file: variantDirOf(sketch, variant),
        message: line.replace(/^NO-CHANGED-STATE /u, ''),
      };
    },
  );
};

const listingOf = async ({
  asked,
  product,
  light,
  signal,
}: {
  asked: Asked;
  product: ResolvedProduct;
  light: boolean;
  signal: AbortSignal;
}) => {
  const { target } = asked;
  const listOnly = light && asked.url.searchParams.get('targets') === 'no';
  const listed = await listSketchesInTurns({ productDir: product.dir, product: product.name });
  const sketches = listed.filter((sketch): sketch is Sketch => typeof sketch !== 'string');
  const checked = light
    ? null
    : asked.checkSketches
      ? await asked.checkSketches({ target, product: product.name })
      : openSketchListingOf(product);
  const unreadable =
    checked?.unreadable ??
    listed.flatMap((sketch): Problem[] =>
      typeof sketch === 'string' ? [{ rule: 'SKETCH', file: product.dir, message: sketch }] : [],
    );

  return {
    status: 200,
    body: {
      sketches: await inTurns({ items: sketches, signal }, async (sketch) => {
        const targets = listOnly
          ? null
          : await targetsOf({
              product,
              sketch,
              load: asked.load,
              pictureOf: asked.pictureOf,
              signal,
              compare: !light,
            });
        const unchanged = checked && targets ? noChangedStateProblemsOf({ sketch, targets }) : [];
        const variants = checked?.variants.filter((entry) => entry.target === sketch.target) ?? [];

        return {
          ...sketchOf({ sketch, target }),
          ...(checked
            ? {
                problems: [
                  ...variants,
                  ...unchanged
                    .filter(({ variant }) => !variants.some((entry) => entry.variant === variant))
                    .map(({ variant }) => ({ variant, problems: [] })),
                ].map((entry) => ({
                  variant: entry.variant,
                  problems: [...entry.problems, ...unchanged.filter(({ variant }) => variant === entry.variant)].map(
                    (problem) => problemOf({ target, problem }),
                  ),
                })),
              }
            : {}),
          ...(targets ? { targets } : {}),
          report: readSketchReport({ checkout: target, sketch }),
        };
      }),
      unreadable: unreadable.map((problem) => problemOf({ target, problem })),
    },
  };
};

const runningListings = new Map<string, { answer: Promise<Answer>; askers: number; stop: AbortController }>();

/**
 * Lets the next sketch listing start anew instead of joining one that started before a file changed. A running listing
 * still answers the requests that already joined it.
 */
export const detachRunningListings = () => runningListings.clear();

const startedListing = ({
  key,
  asked,
  product,
  light,
}: {
  key: string;
  asked: Asked;
  product: ResolvedProduct;
  light: boolean;
}) => {
  const stop = new AbortController();
  const listing = {
    askers: 0,
    stop,
    answer: listingOf({ asked: stoppingOn(asked, stop.signal), product, light, signal: stop.signal }).finally(() => {
      if (runningListings.get(key) === listing) runningListings.delete(key);
    }),
  };

  runningListings.set(key, listing);

  return listing;
};

/**
 * The open sketches of `?product=`, each with its target parts (`targetParts`, the first one first), variants, status,
 * decision, the rule problems of every variant, the states, widths and interactions of each target part as each variant
 * draws it (`targets`, one entry per part and variant, tagged with `part`, the first part's entries first), with the states it
 * draws the same as the product now (`unchanged`), the states it adds and drops and its part note when that differs
 * from the product's (`changes`), and the live report
 * of the agent (`report`, `null` when none runs). `?unchanged=no` answers without `problems`, and with the `unchanged` of a target only
 * while a full listing's comparison of the same sources is kept: no rule check, no pictures. `&targets=no` also leaves out `targets`: no part module loads.
 * A listing asked while the same one runs gets that one's answer, unless `detachRunningListings` ran since it started; it stops when every client that asked for it has closed its request.
 * Each listing first runs the held automatic merges whose uncommitted files are gone.
 */
export const sketchesAnswer = withProduct('GET', ({ asked, config, product }) => {
  retriedHeldMerges({ target: asked.target, config });

  const light = asked.url.searchParams.get('unchanged') === 'no';
  const key = JSON.stringify([asked.target, product.name, light, asked.url.searchParams.get('targets') === 'no']);
  const listing = runningListings.get(key) ?? startedListing({ key, asked, product, light });
  const leave = () => {
    listing.askers -= 1;

    if (listing.askers > 0) return;

    listing.stop.abort();
    if (runningListings.get(key) === listing) runningListings.delete(key);
  };

  listing.askers += 1;

  if (asked.signal?.aborted) leave();
  else if (asked.signal) fromEvent(asked.signal, 'abort').pipe(take(1)).subscribe(leave);

  return listing.answer;
});

/** `?product=&sketch=<layer>/<name>&variant=`: the parts a merge of that variant changes and the elements and pages that show them. */
export const sketchPreviewAnswer = withSketch('GET', ({ asked, product, sketch }) => {
  const variant = asked.url.searchParams.get('variant') ?? '';

  return sketch.variants.includes(variant)
    ? { status: 200, body: { target: sketch.target, ...mergePreviewOf({ product, sketch, variant }) } }
    : failure(404, `${sketch.target} has no variant "${variant}"`);
});

/**
 * `?product=&sketch=&variant=` with optional `size=` (a preset or a width) and `surface=`/`color=`: each state of every
 * element and page that shows the sketch target, drawn now and after merging the variant, split into `changed` and
 * `unchanged` by whether any pixel differs, with the outline of every instance of the target in both pictures.
 */
export const sketchCompareAnswer = withSketch('GET', async ({ asked, product, sketch }) => {
  const variant = asked.url.searchParams.get('variant') ?? '';
  const { load, pictureOf } = asked;

  if (!sketch.variants.includes(variant)) return failure(404, `${sketch.target} has no variant "${variant}"`);
  if (!load || !pictureOf) return failure(503, 'this server draws no pictures');

  return {
    status: 200,
    body: await compareMerge({
      product,
      sketch,
      variant,
      size: asked.url.searchParams.get('size'),
      params: asked.url.searchParams,
      pictureOf,
      load,
    }),
  };
});

/**
 * `?product=&sketch=&variant=&size=` with optional `part=` (a target part, the first by default): per state of that
 * part, the box of the pixels the variant changes against the product now, at rest, in the theme of `surface` and `color`.
 */
export const sketchDiffAnswer = withSketch('GET', async ({ asked, product, sketch }) => {
  const variant = asked.url.searchParams.get('variant') ?? '';
  const part = asked.url.searchParams.get('part') ?? (sketch.targets[0] as string);
  const { load, pictureOf, boxOf } = asked;

  if (!sketch.variants.includes(variant)) return failure(404, `${sketch.target} has no variant "${variant}"`);
  if (!sketch.targets.includes(part)) return failure(404, `${sketch.target} has no target part "${part}"`);
  if (!load || !pictureOf || !boxOf) return failure(503, 'this server draws no pictures');

  return {
    status: 200,
    body: await diffVariant({
      product,
      sketch,
      variant,
      part,
      size: asked.url.searchParams.get('size'),
      params: asked.url.searchParams,
      pictureOf,
      boxOf,
      load,
    }),
  };
});

/**
 * `?product=&sketch=&variants=a,b&size=`: `{ area }`, the one crop around every pixel the variants change in any state
 * against the product now, at rest, and the frame it sits in; `area` is `null` when no pixel changes.
 */
export const sketchCropAnswer = withSketch('GET', async ({ asked, product, sketch }) => {
  const variants = (asked.url.searchParams.get('variants') ?? '').split(',').filter(Boolean);
  const unknown = variants.find((variant) => !sketch.variants.includes(variant));
  const { load, pictureOf, boxOf } = asked;

  if (variants.length === 0) return failure(400, 'variants names no variant');
  if (unknown !== undefined) return failure(404, `${sketch.target} has no variant "${unknown}"`);
  if (!load || !pictureOf || !boxOf) return failure(503, 'this server draws no pictures');

  const diffs = await Promise.all(
    variants.map((variant) =>
      diffVariant({
        product,
        sketch,
        variant,
        size: asked.url.searchParams.get('size'),
        params: asked.url.searchParams,
        pictureOf,
        boxOf,
        load,
      }),
    ),
  );

  return { status: 200, body: { area: changedAreaOf(diffs) } };
});

/**
 * POST `?product=&sketch=`, body `{ kind: 'pick', variant, comment? }`, `{ kind: 'discard', comment? }`, or a verdict
 * by the designer on one variant: `{ kind: 'reject' | 'reopen', variant, reason? }` or `{ kind: 'reason', variant, reason }`.
 * Writes it into sketch.json.
 */
export const sketchDecisionAnswer = withSketch('POST', async ({ asked, sketch }) => {
  const body = await bodyOf(asked.request);
  const kind = body?.['kind'] as SketchDecisionInput['kind'];
  const comment = textOf(body?.['comment']);
  const reason = textOf(body?.['reason']);
  const variant = textOf(body?.['variant']) ?? '';
  const studioOrigin = originOf('designer', `POST ${SKETCH_DECISION_PATH}`);

  if (!SKETCH_DECISION_KINDS.includes(kind))
    return failure(400, `kind must be one of ${SKETCH_DECISION_KINDS.join(', ')}`);
  if (kind !== 'discard' && !variant) return failure(400, `a ${kind} needs a variant`);
  if (kind === 'reason' && !reason) return failure(400, 'a reason needs text');

  const decision: SketchDecisionInput =
    kind === 'discard'
      ? { kind, ...(comment ? { comment } : {}), ...studioOrigin }
      : kind === 'pick'
        ? { kind, variant, ...(comment ? { comment } : {}), ...studioOrigin }
        : { kind, variant, reason: reason ?? '', by: 'designer' };
  const decided = decideSketch({ sketch, decision });

  return typeof decided === 'string'
    ? failure(422, decided)
    : { status: 200, body: sketchOf({ sketch: decided, target: asked.target }) };
});

/**
 * POST `?product=&sketch=`, body `{ note? }`: merges the picked variant into the product, as `et design sketch merge` does.
 * A merge refused for a stale baseline answers 422 with `changed` (the parts, `[]` without a baseline) and the `rebase` command;
 * one the check fails after answers 422 with reason `check-failed` and the check's `findings` lines.
 */
export const sketchMergeAnswer = withSketch('POST', async ({ asked, product, sketch }) => {
  const body = await bodyOf(asked.request);
  const note = textOf(body?.['note']);
  const refused = mergeRefusalOf({ product, sketch });

  if (refused !== null) return failure(422, refused);

  const merged = await mergeInWorker({ target: asked.target, product: product.name, sketch, note });

  if (Array.isArray(merged)) return { status: 200, body: { merged } };

  if (merged.findings)
    return refusal({
      status: 422,
      reason: 'check-failed',
      message: merged.reason,
      extra: { findings: merged.findings },
    });
  if (!merged.changed) return failure(422, merged.reason);

  return {
    status: 422,
    body: {
      error: merged.reason,
      changed: merged.changed,
      rebase: `${repoInvocation({ root: asked.target, subcommand: 'design' })} sketch rebase ${sketch.target} --product ${product.name} --by <model id>`,
    },
  };
});

/** POST `?product=&sketch=`: deletes the sketch with all its variants, as `et design sketch discard` does. */
export const sketchDiscardAnswer = withSketch('POST', ({ asked, sketch }) => {
  const problem = discardSketch({ target: asked.target, sketch });

  return problem ? failure(422, problem) : { status: 200, body: { discarded: sketch.target } };
});

const userNameOf = (dir: string) => {
  try {
    return (
      execFileSync('git', ['config', 'user.name'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    );
  } catch {
    return null;
  }
};

/**
 * `?product=[&part=<layer>/<name>]`: every comment with its `replies`, oldest first, each with the reason it
 * is stale or `null`, its `threadState` (`agent`, `question` or `answered`) and, once closed, its `resolved`; `userName` is
 * the `git config user.name` of the checkout, or `null`.
 */
export const commentsAnswer = withProduct('GET', ({ asked, product }) => {
  const part = asked.url.searchParams.get('part');
  const { comments, unreadable } = listComments({ productDir: product.dir, product: product.name, all: true });

  return {
    status: 200,
    body: {
      comments: comments
        .filter((comment) => !part || comment.part === part)
        .map((comment) => commentOf({ comment, target: asked.target, product })),
      unreadable: unreadable.map(({ file, problem }) => ({ file: relative(asked.target, file), problem })),
      userName: userNameOf(product.dir),
    },
  };
});

/** POST `?product=`, body `{ part, state, size, text, interaction?, point?: { x, y }, sketch?: { target, variant } }`: writes a canvas comment. */
export const commentAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);

  if (!body) return failure(400, 'the body must be a JSON object');

  const { part, state, size, text, interaction, point, sketch } = body;
  const created = createComment({
    product,
    comment: {
      part: part as string,
      state: state as string,
      size: size as CommentSize,
      text: text as string,
      ...(interaction === undefined ? {} : { interaction: interaction as string }),
      ...(point === undefined ? {} : { point: point as { x: number; y: number } }),
      ...(sketch === undefined ? {} : { sketch: sketch as { target: string; variant: string } }),
    },
  });

  return typeof created === 'string'
    ? failure(422, created)
    : { status: 200, body: commentOf({ comment: created, target: asked.target, product }) };
});

/** POST `?product=`, body `{ id, note? }`: the user resolves an open or addressed comment in Studio. */
export const commentDoneAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);

  if (!id) return failure(400, 'the body must be { id, note? }');

  const done = resolveComment({
    products: [{ name: product.name, dir: product.dir }],
    id,
    note: textOf(body?.['note']),
  });

  return typeof done === 'string'
    ? failure(done.startsWith('no open comment') ? 404 : 422, done)
    : { status: 200, body: { id: done.id } };
});

/** POST `?product=`, body `{ id }`: deletes a comment without a note, as the user withdraws it in Studio. */
export const commentWithdrawAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);

  if (!id) return failure(400, 'the body must be { id }');

  const deleted = deleteComment({ products: [{ name: product.name, dir: product.dir }], id });

  return typeof deleted === 'string' ? failure(404, deleted) : { status: 200, body: { id: deleted.id } };
});

/** POST `?product=`, body `{ id, text }`: adds a reply by the user to a comment thread. Answers with the updated comment. */
export const commentReplyAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);
  const text = textOf(body?.['text']);

  if (!id || !text) return failure(400, 'the body must be { id, text }');

  const replied = replyToComment({ products: [{ name: product.name, dir: product.dir }], id, by: 'user', text });

  return typeof replied === 'string'
    ? failure(replied.startsWith('no open comment') ? 404 : 422, replied)
    : { status: 200, body: commentOf({ comment: replied, target: asked.target, product }) };
});

/** `?product=`: the product's flows by name, each with its frames, its lines and what the flow rule finds in it. */
export const flowsAnswer = withProduct('GET', ({ asked, product }) => {
  const { flows, unreadable } = listFlows(product.dir);
  const problems = flowProblemsOf(product);

  return {
    status: 200,
    body: {
      flows: flows.map(({ file, ...flow }) => ({
        ...flow,
        file: relative(asked.target, file),
        problems: problems
          .filter((problem) => problem.file === file)
          .map((problem) => problemOf({ target: asked.target, problem })),
      })),
      unreadable: unreadable.map(({ file, problem }) => ({ file: relative(asked.target, file), problem })),
    },
  };
});

const noteOf = ({ note, target, product }: { note: DesignNote; target: string; product: ResolvedProduct }) => {
  const { file, ...rest } = note;

  return { ...rest, file: relative(target, file), stale: noteProblemOf({ product, note }) };
};

const changeOf = (body: Record<string, unknown>, place: 'point' | 'at') => ({
  ...(body['text'] === undefined ? {} : { text: body['text'] as string }),
  ...(body[place] === undefined ? {} : { [place]: body[place] as { x: number; y: number } | null }),
});

const missingNoteStatusOf = (problem: string) => (/^no (note|flow) |has no note /u.test(problem) ? 404 : 422);

/** `?product=`: the notes on the product's states, each with the reason its part or state is gone, or `null`. */
export const notesAnswer = withProduct('GET', ({ asked, product }) => {
  const { notes, unreadable } = listNotes(product.dir);

  return {
    status: 200,
    body: {
      notes: notes.map((note) => noteOf({ note, target: asked.target, product })),
      unreadable: unreadable.map(({ file, problem }) => ({ file: relative(asked.target, file), problem })),
    },
  };
});

/** POST `?product=`, body `{ part, state, text, point?: { x, y }, size? }`: writes a note on a state into `<product>/notes/`; a point needs its size. */
export const noteAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);

  if (!body) return failure(400, 'the body must be a JSON object');

  const { part, state, text, point, size } = body;
  const created = createNote({
    product,
    note: {
      part: part as string,
      state: state as string,
      text: text as string,
      ...(point === undefined ? {} : { point: point as { x: number; y: number } }),
      ...(size === undefined ? {} : { size: size as string | number }),
    },
  });

  return typeof created === 'string'
    ? failure(422, created)
    : { status: 200, body: noteOf({ note: created, target: asked.target, product }) };
});

/** POST `?product=`, body `{ id, text?, point?: { x, y } | null, size? }`: changes a note on a state; `point: null` drops its point and size. */
export const noteChangeAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);

  if (!body || !id) return failure(400, 'the body must be { id, text?, point? }');

  const change = {
    ...changeOf(body, 'point'),
    ...(body['size'] === undefined ? {} : { size: body['size'] as string | number }),
  } as NoteChange;
  const changed = changeNote({ productDir: product.dir, id, change });

  return typeof changed === 'string'
    ? failure(missingNoteStatusOf(changed), changed)
    : { status: 200, body: noteOf({ note: changed, target: asked.target, product }) };
});

/** POST `?product=`, body `{ id }`: deletes a note on a state. */
export const noteDeleteAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);

  if (!id) return failure(400, 'the body must be { id }');

  const deleted = deleteNote({ productDir: product.dir, id });

  return typeof deleted === 'string' ? failure(missingNoteStatusOf(deleted), deleted) : { status: 200, body: { id } };
});

const withFlowNote = (run: (found: Found & { name: string; body: Record<string, unknown> }) => FlowNote | string) =>
  withProduct('POST', async (found) => {
    const name = found.asked.url.searchParams.get('flow');
    const body = await bodyOf(found.asked.request);

    if (!name) return failure(400, 'flow is required');
    if (!body) return failure(400, 'the body must be a JSON object');

    const answer = run({ ...found, name, body });

    return typeof answer === 'string' ? failure(missingNoteStatusOf(answer), answer) : { status: 200, body: answer };
  });

/** POST `?product=&flow=`, body `{ text, at?: { x, y } }`: adds a free note to `<product>/flows/<flow>.json`. */
export const flowNoteAnswer = withFlowNote(({ product, name, body }) =>
  addFlowNote({
    productDir: product.dir,
    name,
    note: {
      text: body['text'] as string,
      ...(body['at'] === undefined ? {} : { at: body['at'] as { x: number; y: number } }),
    },
  }),
);

/** POST `?product=&flow=`, body `{ id, text?, at?: { x, y } | null }`: changes a free note of a flow; `at: null` lets Studio place it. */
export const flowNoteChangeAnswer = withFlowNote(({ product, name, body }) =>
  changeFlowNote({
    productDir: product.dir,
    name,
    id: String(body['id'] ?? ''),
    change: changeOf(body, 'at') as FlowNoteChange,
  }),
);

/** POST `?product=&flow=`, body `{ id }`: deletes a free note of a flow. */
export const flowNoteDeleteAnswer = withFlowNote(({ product, name, body }) =>
  deleteFlowNote({ productDir: product.dir, name, id: String(body['id'] ?? '') }),
);

const inventoryAnswerOf = async ({ asked, product }: Found, part: unknown): Promise<Inventory | Answer> => {
  if (typeof part !== 'string' || part === '') return failure(400, 'part is required');
  if (!asked.inventoryOf) return failure(503, 'this server draws no inventory');

  const inventory = await asked.inventoryOf({ product, part });

  return typeof inventory === 'string' ? failure(422, inventory) : inventory;
};

const inventoryBodyOf = ({ dir: _dir, ...inventory }: Inventory) => inventory;

/** GET `?product=&part=`: the numbered controls of each rest frame of a page, its part hash and approval state. */
export const inventoryAnswer = withProduct('GET', async (found) => {
  const inventory = await inventoryAnswerOf(found, found.asked.url.searchParams.get('part'));

  return isAnswer(inventory) ? inventory : { status: 200, body: inventoryBodyOf(inventory) };
});

/** POST `?product=`, body `{ part, hash, by }`: the user approves the inventory Studio showed at `hash`. */
export const inventoryApproveAnswer = withProduct('POST', async (found) => {
  const body = await bodyOf(found.asked.request);

  if (!body) return failure(400, 'the body must be a JSON object');

  const inventory = await inventoryAnswerOf(found, body['part']);

  if (isAnswer(inventory)) return inventory;

  const approved = approveInventory({ inventory, hash: body['hash'], by: body['by'] });

  return 'error' in approved
    ? failure(approved.status, approved.error)
    : {
        status: 200,
        body: inventoryBodyOf({ ...inventory, approval: approved, state: { state: 'approved' }, reason: null }),
      };
});

/** GET `?product=`: every requested `design complete` exception with its state at the part's current hash. */
export const exceptionsAnswer = withProduct('GET', ({ product }) => ({ status: 200, body: listExceptions(product) }));

/** POST `?product=`, body `{ key, by }`: the user approves a requested exception at the part's current hash. */
export const exceptionApproveAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);

  if (!body) return failure(400, 'the body must be a JSON object');

  const approved = approveException({ product, key: body['key'], by: body['by'] });

  return 'error' in approved ? failure(approved.status, approved.error) : { status: 200, body: approved };
});

const knownPartOf = (product: ResolvedProduct, part: unknown): string | Answer => {
  if (typeof part !== 'string' || part === '')
    return refusal({ status: 400, reason: 'part-missing', message: 'part is required' });

  const sketched = () =>
    listSketches({ productDir: product.dir, product: product.name }).some(
      (sketch) => typeof sketch !== 'string' && sketch.targets.includes(part),
    );

  return product.parts.some((candidate) => partKeyOf(candidate) === part) || sketched()
    ? part
    : refusal({ status: 404, reason: 'unknown-part', message: `product "${product.name}" has no part "${part}"` });
};

const drawnFindingsAnswerOf = async ({ asked, config, product }: Found, part: string) => {
  const findings = await drawnFindingsOf({ target: asked.target, config, product, parts: [part] });

  return 'unavailable' in findings ? { status: 503, error: `cannot draw ${part}: ${findings.unavailable}` } : findings;
};

/**
 * GET `?product=&part=&draw=`: the open points of one part, or of every part without `part`. Contrasts and missing
 * control states need a draw: only `draw=true` with a `part` lists them, and `drawn` says whether they are in.
 * `directEdit` says whether the merged part changed outside a sketch and waits for an accept; `buildReady` whether the
 * part may be built now, or its blockers.
 */
export const openPointsAnswer = withProduct('GET', async (found) => {
  const { url } = found.asked;
  const draw = url.searchParams.get('draw');
  const asked = url.searchParams.get('part');

  if (draw !== null && draw !== 'true' && draw !== 'false') return failure(400, 'draw is true or false');
  if (asked === null) {
    if (draw === 'true') return failure(400, 'draw needs a part');

    return {
      status: 200,
      body: { drawn: false, ...(await openPointsInWorker({ product: found.product, part: null })) },
    };
  }

  const part = knownPartOf(found.product, asked);

  if (typeof part !== 'string') return part;

  const findings = draw === 'true' ? await drawnFindingsAnswerOf(found, part) : undefined;

  if (findings && 'error' in findings) return failure(findings.status, findings.error);

  const answer = await openPointsInWorker({ product: found.product, part, findings });

  return { status: 200, body: { ...answer, drawn: draw === 'true' } };
});
