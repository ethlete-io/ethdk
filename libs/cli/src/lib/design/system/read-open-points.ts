import { listComments } from './comments/comment';
import { openPointsOf, PartOpenPoints } from './open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';
import { listSketches } from './sketch/sketch';

/** The open points of every part of a product, read from its part files, comments and sketches. */
export const readOpenPoints = (product: ResolvedProduct): PartOpenPoints[] => {
  const source = { productDir: product.dir, product: product.name };

  return openPointsOf({
    parts: product.parts.map((part) => ({
      key: partKeyOf(part),
      layer: part.layer,
      linked: partLinkOf(part.source).kind !== 'none',
    })),
    comments: listComments({ ...source, all: true }).comments.map((comment) => ({
      id: comment.id,
      part: comment.part,
      state: comment.state,
      answered: comment.addressed !== undefined,
      resolved: comment.resolved !== undefined,
    })),
    sketches: listSketches(source).flatMap((sketch) =>
      typeof sketch === 'string'
        ? []
        : [{ targets: sketch.targets, status: sketch.status, decision: sketch.decision?.kind ?? null }],
    ),
  });
};
