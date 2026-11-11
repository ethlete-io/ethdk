import { BuildReadyBlocker, OpenPoint, PartOpenPoints } from '../../host/design-open-points';
import {
  BuildBlocker,
  BuildBlockerKind,
  BuildReadyStatus,
} from '../design-parts/system-page/build-ready-footer.component';
import { OpenPointGroup, OpenPointIcon } from '../design-parts/system-page/system-page-sample';
import { STUDIO_LABELS } from '../i18n/studio-labels';

const LABELS = STUDIO_LABELS.system;

const ICONS: OpenPointIcon[] = ['grid', 'warning', 'comment', 'error', 'flow'];

type ListedPoint = Exclude<OpenPoint, { kind: 'direct-edit' }>;

const iconOf = (point: ListedPoint): OpenPointIcon => {
  switch (point.kind) {
    case 'missing-state':
    case 'unmerged-sketch':
      return 'grid';
    case 'contrast':
      return 'warning';
    case 'sketch-problem':
      return 'error';
    case 'open-comment':
      return 'comment';
    case 'missing-motion':
      return 'flow';
  }
};

const lineOf = (point: ListedPoint): OpenPointGroup['lines'][number] => {
  switch (point.kind) {
    case 'missing-state':
      return point.control
        ? { text: LABELS.controlUndrawn(point.control), detail: point.control }
        : { text: LABELS.noControls, detail: 'controls' };
    case 'contrast':
      return { text: LABELS.belowContrast(point.path), detail: point.state };
    case 'open-comment':
      return { text: point.answered ? LABELS.commentAnswered : LABELS.commentWaiting, detail: point.state };
    case 'unmerged-sketch':
      return { text: point.decision === 'pick' ? LABELS.sketchPicked : LABELS.sketchOpen, detail: 'sketch' };
    case 'sketch-problem':
      return { text: LABELS.sketchProblem(point.rule), detail: point.variant };
    case 'missing-motion':
      return { text: `${point.from} → ${point.to}`, detail: 'motion' };
  }
};

const blockerTextOf = (blocker: BuildReadyBlocker) => {
  switch (blocker.kind) {
    case 'stale-record':
      return LABELS.recordStale;
    case 'pending':
      return LABELS.slowChecksPending;
    case 'no-harness':
      return LABELS.noHarness;
    case 'embedded':
      return blocker.part ? LABELS.embeddedNotReady(blocker.part) : blocker.text;
    default:
      return blocker.text;
  }
};

const blockerLinesOf = ({ buildReady }: PartOpenPoints): OpenPointGroup['lines'] =>
  buildReady.ready
    ? []
    : buildReady.blockers
        .filter((blocker) => blocker.kind !== 'open-point')
        .map((blocker) => ({ text: blockerTextOf(blocker), detail: blocker.part ?? blocker.kind }));

/**
 * The open points of a part grouped by icon, in the order the chip popover lists them; the build-ready blockers that
 * are no open point list as errors.
 */
export const openPointGroupsOf = (answer: PartOpenPoints): OpenPointGroup[] =>
  ICONS.flatMap((icon) => {
    const lines = [
      ...answer.points
        .filter((point): point is ListedPoint => point.kind !== 'direct-edit' && iconOf(point) === icon)
        .map(lineOf),
      ...(icon === 'error' ? blockerLinesOf(answer) : []),
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
 * The build-ready status the chip popover shows: checking only while a slow check is pending or a missing check record
 * is the sole finding, otherwise each blocker with a direct edit as its own kind and the open points in Studio's words.
 */
export const buildReadyStatusOf = ({ points, buildReady }: PartOpenPoints): BuildReadyStatus => {
  if (buildReady.ready) return { state: 'ready' };
  const stale = buildReady.blockers.filter((blocker) => blocker.kind === 'stale-record');
  const others = buildReady.blockers.filter((blocker) => blocker.kind !== 'stale-record');
  if (buildReady.blockers.some((blocker) => blocker.kind === 'pending')) return { state: 'checking' };
  if (stale.length > 0 && others.length === 0 && points.length === 0) return { state: 'checking' };

  const pointBlockers: BuildBlocker[] = points.map((point) =>
    point.kind === 'direct-edit'
      ? { kind: 'direct-edit', text: LABELS.directEdit }
      : { kind: 'open-point', text: lineOf(point).text },
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
