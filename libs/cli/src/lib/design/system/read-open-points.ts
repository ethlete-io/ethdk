import { listComments } from './comments/comment';
import { CompletenessGap, isMissingStateGap } from './complete';
import { OpenPoint, openPointsOf, OpenPointsInput, PartOpenPoints } from './open-points';
import { RenderIssue } from './render-check';
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

/** The points of one part, or none when it has no open point. */
export const partPointsOf = (list: PartOpenPoints[], part: string): OpenPoint[] =>
  list.find((entry) => entry.part === part)?.points ?? [];

/** The `CONTRAST` findings of a render check, once per part, state and path. */
export const contrastsOf = (issues: RenderIssue[]): NonNullable<OpenPointsInput['contrasts']> => {
  const seen = new Set<string>();

  return issues.flatMap(({ rule, part, state, path }) => {
    const key = `${part} ${state} ${path}`;

    if (rule !== 'CONTRAST' || seen.has(key)) return [];

    seen.add(key);

    return [{ part, state, path }];
  });
};

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
