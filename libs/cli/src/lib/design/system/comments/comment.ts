import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { INTERACTIONS } from '../../force-interactions';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from '../sketch/overlay';
import { interactionNamesOf, stateNamesOf, widthsOf } from '../sketch/part-definition';
import { findSketch, parseTarget } from '../sketch/sketch';

/** A point on a frame, in CSS pixels from its top left corner, at the comment's size. */
export type CommentPoint = { x: number; y: number };

/** The size of the frame a comment was made on: a preset name, a width in CSS pixels, or `fitted` to its content. */
export type CommentSize = string | number;

export const FITTED = 'fitted';

export const REST = 'rest';

/**
 * One answer in a comment thread, by the user (from Studio) or by the agent (`et design comment reply`).
 * `author` is the model id of the agent; a reply written before it was recorded has none.
 */
export type CommentReply = { by: 'user' | 'agent'; author?: string; text: string; createdAt: string };

export type CommentFile = {
  part: string;
  state: string;
  size: CommentSize;
  /** `rest` or one of the part's interactions; a file without it is on `rest`. */
  interaction?: string;
  point?: CommentPoint;
  sketch?: { target: string; variant: string };
  text: string;
  createdAt: string;
  replies?: CommentReply[];
};

export type DesignComment = CommentFile & {
  id: string;
  product: string;
  file: string;
  interaction: string;
  replies: CommentReply[];
};

const ID = /^[A-Za-z0-9-]+$/u;

export const commentsDirOf = (productDir: string) => resolve(productDir, 'comments');

export const isPoint = (value: unknown): value is CommentPoint => {
  const point = value as CommentPoint | undefined;

  return typeof point?.x === 'number' && typeof point.y === 'number' && point.x >= 0 && point.y >= 0;
};

const isReply = (value: unknown) => {
  const reply = value as Partial<CommentReply> | undefined;

  return (
    (reply?.by === 'user' || reply?.by === 'agent') &&
    typeof reply.text === 'string' &&
    reply.text !== '' &&
    typeof reply.createdAt === 'string' &&
    (reply.author === undefined || (typeof reply.author === 'string' && reply.author !== ''))
  );
};

const isKnownInteraction = (value: unknown) => value === REST || INTERACTIONS.some((known) => known === value);

const shapeProblemOf = (value: Partial<CommentFile>) => {
  for (const key of ['part', 'state', 'text', 'createdAt'] as const)
    if (typeof value[key] !== 'string' || value[key] === '') return `${key} must be a non-empty string`;

  if (!(typeof value.size === 'string' && value.size !== '') && !(typeof value.size === 'number' && value.size > 0))
    return `size must be a preset name, a width in CSS pixels or "${FITTED}"`;

  if (value.interaction !== undefined && !isKnownInteraction(value.interaction))
    return `interaction must be ${REST} or one of ${INTERACTIONS.join(', ')}`;
  if (value.point !== undefined && !isPoint(value.point)) return 'point must be { x, y } in CSS pixels, both >= 0';
  if (
    value.sketch !== undefined &&
    (typeof value.sketch?.target !== 'string' || typeof value.sketch.variant !== 'string')
  )
    return 'sketch must be { target, variant }';
  if (value.replies !== undefined && !(Array.isArray(value.replies) && value.replies.every(isReply)))
    return 'replies must be [{ by: "user" | "agent", author?, text, createdAt }]';

  return null;
};

/** Every comment file of a product, oldest first; a file that cannot be read answers with its problem. */
export const listComments = (options: { productDir: string; product: string }) => {
  const dir = commentsDirOf(options.productDir);
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  const read = files.map((name): DesignComment | { file: string; problem: string } => {
    const file = resolve(dir, name);

    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<CommentFile>;
      const problem = shapeProblemOf(parsed);

      return problem
        ? { file, problem }
        : {
            ...(parsed as CommentFile),
            interaction: parsed.interaction ?? REST,
            replies: parsed.replies ?? [],
            id: name.slice(0, -'.json'.length),
            product: options.product,
            file,
          };
    } catch (error) {
      return { file, problem: `is no JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
  });

  return {
    comments: read
      .filter((entry): entry is DesignComment => !('problem' in entry))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    unreadable: read.filter((entry): entry is { file: string; problem: string } => 'problem' in entry),
  };
};

/** Why a part key and state name point at nothing in a product, or `null`. A part whose states are not an object literal keeps any state. */
export const goneStateOf = (options: { product: ResolvedProduct; part: string; state: string }) => {
  const { product, part: key, state } = options;
  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  if (!part) return `part ${key} no longer exists`;

  const states = stateNamesOf(part.source);

  return states && !states.includes(state) ? `${key} has no state "${state}"` : null;
};

/** Why a size points at nothing: a preset the product lacks, or a width a part with readable `widths` lacks. */
const goneSizeOf = (options: { product: ResolvedProduct; part: string; size: CommentSize }) => {
  const { product, part: key, size } = options;

  if (typeof size === 'string')
    return size === FITTED || product.presets[size] ? null : `preset "${size}" no longer exists`;

  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);
  const widths = part ? widthsOf(part.source) : null;

  return widths === null || widths.includes(size) ? null : `${key} has no width ${size}`;
};

/** Why an interaction points at nothing: one the part no longer declares. */
const goneInteractionOf = (options: { product: ResolvedProduct; part: string; interaction?: string }) => {
  const { product, part: key, interaction = REST } = options;

  if (interaction === REST) return null;

  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  return part && !interactionNamesOf(part.source).includes(interaction)
    ? `${key} has no interaction "${interaction}"`
    : null;
};

/**
 * Why a comment no longer points at anything: its sketch variant, part, state, size or interaction is gone.
 * `null` when it still does. A part whose states are not an object literal keeps any state.
 */
export const staleReasonOf = (options: {
  product: ResolvedProduct;
  comment: Omit<CommentFile, 'text' | 'createdAt'>;
}): string | null => {
  const { product, comment } = options;
  let drawn = product;

  if (comment.sketch) {
    const parsed = parseTarget(comment.sketch.target);
    const sketch =
      typeof parsed === 'string'
        ? null
        : findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

    if (!sketch || typeof sketch === 'string') return `the sketch on ${comment.sketch.target} no longer exists`;
    if (!sketch.variants.includes(comment.sketch.variant))
      return `the sketch on ${comment.sketch.target} has no variant "${comment.sketch.variant}"`;

    drawn = overlaySketch({ product, sketch, variant: comment.sketch.variant });
  }

  const gone = goneStateOf({ product: drawn, part: comment.part, state: comment.state });

  if (gone) return gone;
  return (
    goneSizeOf({ product: drawn, part: comment.part, size: comment.size }) ??
    goneInteractionOf({ product: drawn, part: comment.part, interaction: comment.interaction })
  );
};

const newId = () =>
  `${new Date()
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d+Z$/u, 'Z')}-${randomBytes(2).toString('hex')}`;

/** Writes a comment on a state of a part, or answers with why it points at nothing. */
export const createComment = (options: {
  product: ResolvedProduct;
  comment: Omit<CommentFile, 'createdAt'>;
}): DesignComment | string => {
  const { product } = options;
  const { interaction, ...rest } = options.comment;
  const comment: CommentFile = {
    ...rest,
    ...(interaction === undefined || interaction === REST ? {} : { interaction }),
    createdAt: new Date().toISOString(),
  };
  const problem = shapeProblemOf({ ...comment, interaction }) ?? staleReasonOf({ product, comment });

  if (problem) return problem;

  const dir = commentsDirOf(product.dir);
  const id = newId();
  const file = resolve(dir, `${id}.json`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(comment, null, 2)}\n`);

  return { ...comment, interaction: comment.interaction ?? REST, replies: [], id, product: product.name, file };
};

/** Who spoke last in a comment thread: the user wrote the comment, so a thread without replies is the user's. */
export const lastWordOf = (comment: Pick<DesignComment, 'replies'>) =>
  comment.replies[comment.replies.length - 1]?.by ?? 'user';

export const findComment = (options: { products: { name: string; dir: string }[]; id: string }) => {
  const { products, id } = options;

  if (!ID.test(id)) return `"${id}" is no comment id`;

  for (const product of products) {
    const found = listComments({ productDir: product.dir, product: product.name }).comments.find(
      (comment) => comment.id === id,
    );

    if (found) return found;
  }

  return `no open comment "${id}"`;
};

/** Adds a reply to the thread of an open comment, searching the named products. Answers with the updated comment. */
export const replyToComment = (options: {
  products: { name: string; dir: string }[];
  id: string;
  by: CommentReply['by'];
  author?: string;
  text: string;
}): DesignComment | string => {
  const { by, author, text } = options;

  if (text.trim() === '') return 'a reply needs a text';
  if (by === 'agent' && !author?.trim()) return 'an agent reply needs --by <model id>';

  const found = findComment(options);

  if (typeof found === 'string') return found;

  const replies = [...found.replies, { by, ...(author ? { author } : {}), text, createdAt: new Date().toISOString() }];
  const stored = JSON.parse(readFileSync(found.file, 'utf8')) as CommentFile;

  writeFileSync(found.file, `${JSON.stringify({ ...stored, replies }, null, 2)}\n`);

  return { ...found, replies };
};

/** Deletes a done or withdrawn comment thread by its id, searching the named products. Answers with the deleted comment. */
export const deleteComment = (options: {
  products: { name: string; dir: string }[];
  id: string;
}): DesignComment | string => {
  const found = findComment(options);

  if (typeof found !== 'string') rmSync(found.file);

  return found;
};

/** The open comments made on any variant of the sketch on a target. */
export const commentsOnSketch = (options: { productDir: string; product: string; sketch: string }) =>
  listComments(options).comments.filter((comment) => comment.sketch?.target === options.sketch);
