import { Layer } from './layers';
import { SketchDecision, SketchStatus } from './sketch/sketch';

/** Every kind of open point, in the order a part lists them. */
export const OPEN_POINT_KINDS = [
  'missing-state',
  'contrast',
  'open-comment',
  'unmerged-sketch',
  'plan-question',
  'unlinked',
  'missing-motion',
] as const;

export type OpenPointKind = (typeof OPEN_POINT_KINDS)[number];

/**
 * Something that keeps a part from being done. `open-comment` is a thread the user has not resolved, `answered` when
 * it waits on the user; `unmerged-sketch` is a sketch on the part that is still there, picked or not.
 */
export type OpenPoint =
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | { kind: 'unmerged-sketch'; status: SketchStatus; decision: SketchDecision['kind'] | null }
  | { kind: 'unlinked' };

export type OpenPointsInput = {
  parts: { key: string; layer: Layer; linked: boolean }[];
  comments: { id: string; part: string; state: string; answered: boolean; resolved: boolean }[];
  sketches: { targets: string[]; status: SketchStatus; decision: SketchDecision['kind'] | null }[];
};

export type PartOpenPoints = { part: string; points: OpenPoint[] };

const rankOf = (point: OpenPoint) => OPEN_POINT_KINDS.indexOf(point.kind);

/** The open points of each part that has any, in the order of `parts`, each list in the order of `OPEN_POINT_KINDS`. */
export const openPointsOf = (input: OpenPointsInput): PartOpenPoints[] =>
  input.parts.flatMap(({ key, layer, linked }) => {
    const points: OpenPoint[] = [
      ...(linked || layer === 'foundations' ? [] : [{ kind: 'unlinked' as const }]),
      ...input.sketches
        .filter((sketch) => sketch.targets.includes(key))
        .map((sketch) => ({ kind: 'unmerged-sketch' as const, status: sketch.status, decision: sketch.decision })),
      ...input.comments
        .filter((comment) => comment.part === key && !comment.resolved)
        .map((comment) => ({
          kind: 'open-comment' as const,
          comment: comment.id,
          state: comment.state,
          answered: comment.answered,
        })),
    ].sort((a, b) => rankOf(a) - rankOf(b));

    return points.length > 0 ? [{ part: key, points }] : [];
  });

const sketchText = (point: Extract<OpenPoint, { kind: 'unmerged-sketch' }>) =>
  point.decision === 'pick'
    ? 'sketch picked, not merged'
    : point.decision === 'discard'
      ? 'sketch discarded, not removed'
      : point.status === 'ready'
        ? 'sketch ready, not merged'
        : 'sketch in progress';

const groupText = (kind: OpenPointKind, points: OpenPoint[]) => {
  if (kind === 'open-comment') {
    const ids = points.map((point) => (point.kind === 'open-comment' ? point.comment : ''));

    return `${ids.length} open comment${ids.length === 1 ? '' : 's'} (${ids.join(', ')})`;
  }

  if (kind === 'unlinked') return 'no implements';

  return points.map((point) => (point.kind === 'unmerged-sketch' ? sketchText(point) : point.kind)).join('; ');
};

/** One header line with the total, then one line per part with its points, as `design check` prints them. */
export const openPointsText = (product: string, list: PartOpenPoints[]): string[] => {
  const total = list.reduce((sum, part) => sum + part.points.length, 0);

  if (total === 0) return [`OPEN POINTS ${product}: none`];

  return [
    `OPEN POINTS ${product}: ${total} in ${list.length} part${list.length === 1 ? '' : 's'}`,
    ...list.map(({ part, points }) => {
      const groups = OPEN_POINT_KINDS.flatMap((kind) => {
        const ofKind = points.filter((point) => point.kind === kind);

        return ofKind.length > 0 ? [groupText(kind, ofKind)] : [];
      });

      return `  ${part}: ${groups.join('; ')}`;
    }),
  ];
};
