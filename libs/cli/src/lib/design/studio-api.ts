import { IncomingMessage } from 'http';
import { relative } from 'path';
import { DesignConfig, readConfig } from './paths';
import {
  CommentSize,
  createComment,
  deleteComment,
  DesignComment,
  listComments,
  replyToComment,
  staleReasonOf,
} from './system/comments/comment';
import { completeComment } from './system/comments/complete';
import { Problem } from './system/problem';
import { ResolvedProduct } from './system/resolve-product';
import { openSketchProblemsOf } from './system/sketch/check-sketches';
import { oneProductOf } from './system/sketch/cli-args';
import { discardSketch, mergeSketch } from './system/sketch/merge';
import { readPartModule } from './system/list-system';
import { mergePreviewOf } from './system/sketch/merge-preview';
import { overlaySketch } from './system/sketch/overlay';
import { decideSketch, findSketch, listSketches, parseTarget, readSketchReport, Sketch } from './system/sketch/sketch';
import { partKeyOf } from './system/resolve-product';
import { SketchVariant } from './system/system-modules';

export const SKETCHES_PATH = '/__design/sketches';
export const SKETCH_PREVIEW_PATH = '/__design/sketch-preview';
export const SKETCH_DECISION_PATH = '/__design/sketch-decision';
export const SKETCH_MERGE_PATH = '/__design/sketch-merge';
export const SKETCH_DISCARD_PATH = '/__design/sketch-discard';
export const COMMENTS_PATH = '/__design/comments';
export const COMMENT_PATH = '/__design/comment';
export const COMMENT_DONE_PATH = '/__design/comment-done';
export const COMMENT_WITHDRAW_PATH = '/__design/comment-withdraw';
export const COMMENT_REPLY_PATH = '/__design/comment-reply';
export const COMMENT_EVENTS_PATH = '/__design/comment-events';

export type Answer = { status: number; body: unknown };

/** Answers with the module of a part file as one variant of a sketch draws it. */
export type VariantPartLoader = (options: { file: string; product: string; sketch: SketchVariant }) => Promise<unknown>;

type Asked = { target: string; url: URL; request: IncomingMessage; load?: VariantPartLoader };

const failure = (status: number, message: string): Answer => ({ status, body: { error: message } });

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

const withSketch = (method: 'GET' | 'POST', run: (found: Found & { sketch: Sketch }) => Answer | Promise<Answer>) =>
  withProduct(method, (found) => {
    const parsed = parseTarget(found.asked.url.searchParams.get('sketch') ?? undefined);

    if (typeof parsed === 'string') return failure(400, parsed);

    const sketch = findSketch({ productDir: found.product.dir, product: found.product.name, sketch: parsed });

    if (sketch === null) return failure(404, `no sketch on ${parsed.layer}/${parsed.name} in ${found.product.name}`);
    if (typeof sketch === 'string') return failure(422, sketch);

    return run({ ...found, sketch });
  });

const problemOf = ({ target, problem }: { target: string; problem: Problem }) => ({
  rule: problem.rule,
  file: relative(target, problem.file),
  message: problem.message,
});

const sketchOf = ({ sketch: { dir, ...sketch }, target }: { sketch: Sketch; target: string }) => ({
  ...sketch,
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

  return { ...rest, file: relative(target, file), stale: staleReasonOf({ product, comment }) };
};

const targetsOf = async ({
  product,
  sketch,
  load,
}: {
  product: ResolvedProduct;
  sketch: Sketch;
  load?: VariantPartLoader;
}) =>
  Promise.all(
    sketch.variants.map(async (variant) => {
      const file = overlaySketch({ product, sketch, variant }).parts.find(
        (part) => partKeyOf(part) === sketch.target,
      )?.file;

      if (!file || !load)
        return {
          variant,
          states: [],
          interactions: [],
          ...(file ? {} : { error: `variant ${variant} has no part ${sketch.target}` }),
        };

      const { states, interactions, problem, ...widths } = await readPartModule({
        part: { file },
        product: product.name,
        load: () => load({ file, product: product.name, sketch: { target: sketch.target, variant } }),
      });

      return {
        variant,
        states,
        ...('widths' in widths ? { widths: widths.widths } : {}),
        interactions,
        ...(problem ? { error: problem } : {}),
      };
    }),
  );

/**
 * The open sketches of `?product=`, each with its variants, status, decision, the rule problems of every
 * variant, the states, widths and interactions of the target as each variant draws it (`targets`), and the live report
 * of the agent (`report`, `null` when none runs).
 */
export const sketchesAnswer = withProduct('GET', async ({ asked, product }) => {
  const { target } = asked;
  const { unreadable, variants } = openSketchProblemsOf(product);
  const sketches = listSketches({ productDir: product.dir, product: product.name }).filter(
    (sketch): sketch is Sketch => typeof sketch !== 'string',
  );

  return {
    status: 200,
    body: {
      sketches: await Promise.all(
        sketches.map(async (sketch) => ({
          ...sketchOf({ sketch, target }),
          problems: variants
            .filter((entry) => entry.sketch.target === sketch.target)
            .map((entry) => ({
              variant: entry.variant,
              problems: entry.problems.map((p) => problemOf({ target, problem: p })),
            })),
          targets: await targetsOf({ product, sketch, load: asked.load }),
          report: readSketchReport({ checkout: target, sketch }),
        })),
      ),
      unreadable: unreadable.map((problem) => problemOf({ target, problem })),
    },
  };
});

/** `?product=&sketch=<layer>/<name>&variant=`: the parts a merge of that variant changes and the elements and pages that show them. */
export const sketchPreviewAnswer = withSketch('GET', ({ asked, product, sketch }) => {
  const variant = asked.url.searchParams.get('variant') ?? '';

  return sketch.variants.includes(variant)
    ? { status: 200, body: mergePreviewOf({ product, sketch, variant }) }
    : failure(404, `${sketch.target} has no variant "${variant}"`);
});

/** POST `?product=&sketch=`, body `{ kind: 'pick', variant, comment? }` or `{ kind: 'discard', comment? }`: writes the decision into sketch.json. */
export const sketchDecisionAnswer = withSketch('POST', async ({ asked, sketch }) => {
  const body = await bodyOf(asked.request);
  const comment = textOf(body?.['comment']);
  const variant = textOf(body?.['variant']);

  if (body?.['kind'] !== 'pick' && body?.['kind'] !== 'discard') return failure(400, 'kind must be pick or discard');
  if (body['kind'] === 'pick' && !variant) return failure(400, 'a pick needs a variant');

  const decided = decideSketch({
    sketch,
    decision:
      body['kind'] === 'pick' && variant
        ? { kind: 'pick', variant, ...(comment ? { comment } : {}) }
        : { kind: 'discard', ...(comment ? { comment } : {}) },
  });

  return typeof decided === 'string'
    ? failure(422, decided)
    : { status: 200, body: sketchOf({ sketch: decided, target: asked.target }) };
});

/** POST `?product=&sketch=`, body `{ note }`: merges the picked variant into the product, as `et design sketch merge` does. */
export const sketchMergeAnswer = withSketch('POST', async ({ asked, config, product, sketch }) => {
  const body = await bodyOf(asked.request);
  const note = textOf(body?.['note']);

  if (!note) return failure(400, 'a merge needs a note');

  const merged = mergeSketch({ target: asked.target, config, product, sketch, note });

  return typeof merged === 'string' ? failure(422, merged) : { status: 200, body: { merged } };
});

/** POST `?product=&sketch=`: deletes the sketch with all its variants, as `et design sketch discard` does. */
export const sketchDiscardAnswer = withSketch('POST', ({ asked, sketch }) => {
  const problem = discardSketch({ target: asked.target, sketch });

  return problem ? failure(422, problem) : { status: 200, body: { discarded: sketch.target } };
});

/** `?product=[&part=<layer>/<name>]`: the open comments with their `replies`, oldest first, each with the reason it is stale or `null`. */
export const commentsAnswer = withProduct('GET', ({ asked, product }) => {
  const part = asked.url.searchParams.get('part');
  const { comments, unreadable } = listComments({ productDir: product.dir, product: product.name });

  return {
    status: 200,
    body: {
      comments: comments
        .filter((comment) => !part || comment.part === part)
        .map((comment) => commentOf({ comment, target: asked.target, product })),
      unreadable: unreadable.map(({ file, problem }) => ({ file: relative(asked.target, file), problem })),
    },
  };
});

/** POST `?product=`, body `{ part, state, size, text, point?: { x, y }, sketch?: { target, variant } }`: writes a canvas comment. */
export const commentAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);

  if (!body) return failure(400, 'the body must be a JSON object');

  const { part, state, size, text, point, sketch } = body;
  const created = createComment({
    product,
    comment: {
      part: part as string,
      state: state as string,
      size: size as CommentSize,
      text: text as string,
      ...(point === undefined ? {} : { point: point as { x: number; y: number } }),
      ...(sketch === undefined ? {} : { sketch: sketch as { target: string; variant: string } }),
    },
  });

  return typeof created === 'string'
    ? failure(422, created)
    : { status: 200, body: commentOf({ comment: created, target: asked.target, product }) };
});

/** POST `?product=`, body `{ id, note }`: replaces the note of the part the comment is about and deletes the comment, as `et design inbox done` does. */
export const commentDoneAnswer = withProduct('POST', async ({ asked, product }) => {
  const body = await bodyOf(asked.request);
  const id = textOf(body?.['id']);
  const note = textOf(body?.['note']);

  if (!id || !note) return failure(400, 'the body must be { id, note }');

  const done = completeComment({ products: [product], id, note });

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
