import { listComments } from './comments/comment';
import { openPointsOf, OpenPointsInput, PartOpenPoints } from './open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { declaresControlsOf, motionRefsOf, partLinkOf, stateNamesOf, unreachableOf } from './sketch/part-definition';
import { listSketches } from './sketch/sketch';

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
    },
  };
};

/**
 * The open points of every part of a product, read from its part files, comments and sketches, plus the
 * `rendered` findings of a check that drew the parts.
 */
export const readOpenPoints = (
  product: ResolvedProduct,
  rendered: Pick<OpenPointsInput, 'missingStates' | 'contrasts'> = {},
): PartOpenPoints[] => {
  const source = { productDir: product.dir, product: product.name };

  return openPointsOf({
    parts: product.parts.map((part) => ({
      key: partKeyOf(part),
      layer: part.layer,
      linked: partLinkOf(part.source).kind !== 'none',
      controls: declaresControlsOf(part.source),
      ...motionOf(part.source),
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
    ...rendered,
  });
};
