import { BuildReadyBlocker, OpenPoint, PartOpenPoints } from '../../host/design-open-points';
import {
  BuildBlocker,
  BuildBlockerKind,
  BuildReadyStatus,
} from '../design-parts/system-page/build-ready-footer.component';
import { OpenPointGroup, OpenPointIcon, OpenPointLine } from '../design-parts/system-page/system-page-sample';
import { SYSTEM_LABELS } from '../i18n/system-labels';

const LABELS = SYSTEM_LABELS;

const ICONS: OpenPointIcon[] = ['grid', 'comment', 'error', 'flow'];

type ListedPoint = Exclude<OpenPoint, { kind: 'direct-edit' | 'sketch-problem' | 'stale-sketch-base' }>;

const isListed = (point: OpenPoint): point is ListedPoint =>
  point.kind !== 'direct-edit' &&
  point.kind !== 'sketch-problem' &&
  point.kind !== 'stale-sketch-base' &&
  (point.kind !== 'open-comment' || point.answered === true);

const isShown = (point: OpenPoint) => point.kind === 'direct-edit' || isListed(point);

const HIDDEN_BLOCKERS = new Set<BuildReadyBlocker['kind']>(['stale-record', 'pending', 'no-harness']);

const ICON_OF: Record<ListedPoint['kind'], OpenPointIcon> = {
  'missing-state': 'grid',
  redraw: 'grid',
  'unmerged-sketch': 'grid',
  'open-comment': 'comment',
  'missing-motion': 'flow',
};

const iconOf = (point: ListedPoint): OpenPointIcon => ICON_OF[point.kind];

const lineOf = (point: ListedPoint): OpenPointLine => {
  switch (point.kind) {
    case 'missing-state':
      if (point.data) {
        return {
          text: LABELS.dataStateUndrawn(point.data),
          detail: point.state ? `${point.data} (${point.state})` : point.data,
        };
      }

      return point.control
        ? { text: LABELS.controlUndrawn(point.control), detail: point.control }
        : { text: LABELS.noControls, detail: 'controls' };
    case 'redraw':
      return { text: LABELS.builtPlaceholder, detail: point.state, target: { kind: 'state', state: point.state } };
    case 'open-comment':
      return {
        text: LABELS.commentAnswered,
        detail: point.state,
        target: { kind: 'comment', comment: point.comment },
      };
    case 'unmerged-sketch':
      return {
        text: point.decision === 'pick' ? LABELS.sketchPicked : LABELS.sketchOpen,
        detail: 'sketch',
        target: { kind: 'sketch', sketch: point.sketch },
      };
    case 'missing-motion':
      return {
        text: `${point.from} → ${point.to}`,
        detail: 'motion',
        target: { kind: 'state', state: point.from },
      };
  }
};

const blockerTextOf = (blocker: BuildReadyBlocker) => {
  switch (blocker.kind) {
    case 'embedded':
      return blocker.part ? LABELS.embeddedNotReady(blocker.part) : blocker.text;
    default:
      return blocker.text;
  }
};

const directEditLinesOf = ({ points }: PartOpenPoints): OpenPointLine[] =>
  points.flatMap((point): OpenPointLine[] =>
    point.kind !== 'direct-edit'
      ? []
      : point.sketch
        ? [{ text: LABELS.directEdit, detail: point.sketch, target: { kind: 'edit-sketch', target: point.sketch } }]
        : [{ text: LABELS.directEdit, detail: point.kind }],
  );

const blockerLinesOf = ({ buildReady }: PartOpenPoints): OpenPointLine[] =>
  buildReady.ready
    ? []
    : buildReady.blockers
        .filter((blocker) => blocker.kind !== 'open-point' && !HIDDEN_BLOCKERS.has(blocker.kind))
        .map((blocker) =>
          blocker.part
            ? { text: blockerTextOf(blocker), detail: blocker.part, target: { kind: 'part', part: blocker.part } }
            : { text: blockerTextOf(blocker), detail: blocker.kind },
        );

/**
 * The open points of a part grouped by icon, in the order the chip popover lists them; the build-ready blockers that
 * are no open point list as errors.
 */
export const openPointGroupsOf = (answer: PartOpenPoints): OpenPointGroup[] =>
  ICONS.flatMap((icon) => {
    const lines = [
      ...answer.points
        .filter(isListed)
        .filter((point) => iconOf(point) === icon)
        .map(lineOf),
      ...(icon === 'error' ? [...directEditLinesOf(answer), ...blockerLinesOf(answer)] : []),
    ];

    return lines.length > 0 ? [{ icon, lines }] : [];
  });

const RULE_KINDS = new Set<BuildBlockerKind>(['embedded', 'problem', 'compare', 'sdk-error']);

const ruleBlockerOf = (blocker: BuildReadyBlocker): BuildBlocker => ({
  kind: RULE_KINDS.has(blocker.kind as BuildBlockerKind) ? (blocker.kind as BuildBlockerKind) : 'problem',
  text: blockerTextOf(blocker),
  ...(blocker.part ? { part: blocker.part } : {}),
});

/**
 * The build-ready status the chip popover shows: blocked as soon as one blocker is definite, even while a slow check
 * runs; checking while only a pending check or a missing check record is left. A product without a harness is
 * blocked without a listed blocker, since its app checks never run. A blocked status lists each definite
 * blocker, with a direct edit as its own kind and the open points in Studio's words.
 */
export const buildReadyStatusOf = (answer: PartOpenPoints): BuildReadyStatus => {
  const status = statusOf(answer);

  return answer.developer ? { ...status, developer: answer.developer } : status;
};

const statusOf = ({ points: all, buildReady }: PartOpenPoints): BuildReadyStatus => {
  if (buildReady.ready) return { state: 'ready' };
  const points = all.filter(isShown);
  const others = buildReady.blockers.filter((blocker) => !HIDDEN_BLOCKERS.has(blocker.kind));
  if (others.length === 0 && points.length === 0)
    return buildReady.blockers.some(({ kind }) => kind === 'no-harness')
      ? { state: 'blocked', blockers: [] }
      : { state: 'checking' };

  const pointBlockers: BuildBlocker[] = points.map((point) =>
    isListed(point)
      ? { kind: 'open-point', text: lineOf(point).text }
      : { kind: 'direct-edit', text: LABELS.directEdit },
  );
  const blockers: BuildBlocker[] = [
    ...(pointBlockers.length > 0
      ? pointBlockers
      : others
          .filter((blocker) => blocker.kind === 'open-point')
          .map((blocker) => ({ kind: 'open-point' as const, text: blocker.text }))),
    ...others.filter((blocker) => blocker.kind !== 'open-point').map(ruleBlockerOf),
  ];

  return { state: 'blocked', blockers };
};

const SKETCH_KINDS = new Set<OpenPoint['kind']>(['unmerged-sketch']);

/** The open points a sketch brings to its target, grouped like the chip popover lists them. */
export const sketchPointGroupsOf = ({ points }: PartOpenPoints): OpenPointGroup[] =>
  openPointGroupsOf({ points: points.filter((point) => SKETCH_KINDS.has(point.kind)), buildReady: { ready: true } });
