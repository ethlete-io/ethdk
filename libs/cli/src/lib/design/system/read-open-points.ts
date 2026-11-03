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
import { goStateOf } from './part-go';
import { RenderIssue } from './render-check';
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
      instant: instantOf(source).kind === 'declared',
    },
  };
};

const partInputsOf = (product: ResolvedProduct): OpenPointsInput['parts'] =>
  product.parts.map((part) => ({
    key: partKeyOf(part),
    layer: part.layer,
    linked: partLinkOf(part.source).kind !== 'none',
    go: goStateOf({ product, part: partKeyOf(part) }),
    controls: declaresControlsOf(part.source),
    declaredNoControls: declaresNoControlsOf(part.source),
    ...motionOf(part.source),
  }));

/**
 * The open points of every part of a product, read from its part files, comments and sketches, plus the
 * `rendered` findings of a check that drew the parts.
 */
export const readOpenPoints = (
  product: ResolvedProduct,
  rendered: Pick<OpenPointsInput, 'missingStates' | 'contrasts' | 'busyStates'> = {},
): PartOpenPoints[] => {
  const source = { productDir: product.dir, product: product.name };

  return openPointsOf({
    parts: partInputsOf(product),
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
        : [
            {
              name: sketch.name,
              target: sketch.target,
              targets: sketch.targets,
              status: sketch.status,
              decision: sketch.decision?.kind ?? null,
            },
          ],
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
