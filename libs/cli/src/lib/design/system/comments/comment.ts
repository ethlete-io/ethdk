import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from '../sketch/overlay';
import { stateNamesOf } from '../sketch/part-definition';
import { findSketch, parseTarget } from '../sketch/sketch';

/** A point on a frame, in CSS pixels from its top left corner, at the comment's preset. */
export type CommentPoint = { x: number; y: number };

export type CommentFile = {
  part: string;
  state: string;
  preset: string;
  point?: CommentPoint;
  sketch?: { target: string; variant: string };
  text: string;
  createdAt: string;
};

export type DesignComment = CommentFile & { id: string; product: string; file: string };

const ID = /^[A-Za-z0-9-]+$/u;

export const commentsDirOf = (productDir: string) => resolve(productDir, 'comments');

const isPoint = (value: unknown): value is CommentPoint => {
  const point = value as CommentPoint | undefined;

  return typeof point?.x === 'number' && typeof point.y === 'number' && point.x >= 0 && point.y >= 0;
};

const shapeProblemOf = (value: Partial<CommentFile>) => {
  for (const key of ['part', 'state', 'preset', 'text', 'createdAt'] as const)
    if (typeof value[key] !== 'string' || value[key] === '') return `${key} must be a non-empty string`;

  if (value.point !== undefined && !isPoint(value.point)) return 'point must be { x, y } in CSS pixels, both >= 0';
  if (
    value.sketch !== undefined &&
    (typeof value.sketch?.target !== 'string' || typeof value.sketch.variant !== 'string')
  )
    return 'sketch must be { target, variant }';

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
        : { ...(parsed as CommentFile), id: name.slice(0, -'.json'.length), product: options.product, file };
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

/**
 * Why a comment no longer points at anything: its sketch variant, part, state or preset is gone.
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

  const part = drawn.parts.find((candidate) => partKeyOf(candidate) === comment.part);

  if (!part) return `part ${comment.part} no longer exists`;

  const states = stateNamesOf(part.source);

  if (states && !states.includes(comment.state)) return `${comment.part} has no state "${comment.state}"`;
  if (!product.presets[comment.preset]) return `preset "${comment.preset}" no longer exists`;

  return null;
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
  const comment: CommentFile = { ...options.comment, createdAt: new Date().toISOString() };
  const problem = shapeProblemOf(comment) ?? staleReasonOf({ product, comment });

  if (problem) return problem;

  const dir = commentsDirOf(product.dir);
  const id = newId();
  const file = resolve(dir, `${id}.json`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(comment, null, 2)}\n`);

  return { ...comment, id, product: product.name, file };
};

/** Deletes a done comment by its id, searching the named products. Answers with the deleted comment. */
export const deleteComment = (options: {
  products: { name: string; dir: string }[];
  id: string;
}): DesignComment | string => {
  const { products, id } = options;

  if (!ID.test(id)) return `"${id}" is no comment id`;

  for (const product of products) {
    const found = listComments({ productDir: product.dir, product: product.name }).comments.find(
      (comment) => comment.id === id,
    );

    if (found) {
      rmSync(found.file);

      return found;
    }
  }

  return `no open comment "${id}"`;
};

/** The open comments made on any variant of the sketch on a target. */
export const commentsOnSketch = (options: { productDir: string; product: string; sketch: string }) =>
  listComments(options).comments.filter((comment) => comment.sketch?.target === options.sketch);
