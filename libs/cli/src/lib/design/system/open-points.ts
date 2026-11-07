import { Layer } from './layers';
import { SketchDecision, SketchStatus } from './sketch/sketch';

/** Every kind of open point, in the order a part lists them. */
export const OPEN_POINT_KINDS = [
  'missing-state',
  'contrast',
  'open-comment',
  'unmerged-sketch',
  'direct-edit',
  'plan-question',
  'missing-motion',
] as const;

export type OpenPointKind = (typeof OPEN_POINT_KINDS)[number];

/** The kinds a sketch closes in its own variant; the others exist only after a merge or outside the sketch. */
export const SKETCH_KINDS: readonly OpenPointKind[] = ['missing-state', 'contrast', 'missing-motion'];

/**
 * Something that keeps a part from being done. `missing-state` is a control without a drawn state (`control` null when
 * the part declares no controls); `contrast` is a drawn state under the contrast rule; `open-comment` is a thread the
 * user has not resolved, `answered` when it waits on the user; `unmerged-sketch` is a sketch on the part that is still
 * there, picked or not; `direct-edit` is a merged part changed outside a sketch, with the old/new sketch it waits on
 * (`sketch` null until one is open); `missing-motion` is a pair of states without a motion between them, or, with `from` equal to
 * `to`, an ongoing-work state without its looping motion.
 */
export type OpenPoint =
  | { kind: 'missing-state'; control: string | null }
  | { kind: 'contrast'; state: string; path: string }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | {
      kind: 'unmerged-sketch';
      sketch: string;
      primary: boolean;
      status: SketchStatus;
      decision: SketchDecision['kind'] | null;
    }
  | { kind: 'direct-edit'; sketch: string | null }
  | { kind: 'missing-motion'; from: string; to: string };

/** The state pairs of a part as its file declares them, read without running it. */
export type PartMotions = {
  states: string[];
  motions: { from: string; to: string }[];
  unreachable: { from: string; to: string }[];
  instant?: boolean;
};

/**
 * What the open points are read from. `controls` is whether the part declares any, `declaredNoControls` that it says outright it has none, `motion` is left out when its
 * states cannot be read; `missingStates` and `contrasts` come
 * from drawing the parts, so a check without a browser leaves them out. `busyStates` are drawn states whose render
 * holds `aria-busy="true"` or a loading button: each is ongoing work whatever its name.
 */
export type OpenPointsInput = {
  parts: {
    key: string;
    layer: Layer;
    controls: boolean;
    declaredNoControls?: boolean;
    motion?: PartMotions;
  }[];
  comments: { id: string; part: string; state: string; answered: boolean; resolved: boolean }[];
  sketches: {
    name: string;
    target: string;
    targets: string[];
    status: SketchStatus;
    decision: SketchDecision['kind'] | null;
  }[];
  missingStates?: { part: string; control: string }[];
  contrasts?: { part: string; state: string; path: string }[];
  busyStates?: { part: string; state: string }[];
  directEdits?: { part: string; sketch: string | null }[];
};

const STATELESS_LAYERS: Layer[] = ['foundations', 'pages'];

const ONGOING_WORK = ['loading', 'pending', 'busy', 'progress', 'indeterminate', 'spinner'];

const isOngoingWork = (state: string, busy: string[]) =>
  busy.includes(state) || ONGOING_WORK.some((word) => state.includes(word));

const missingMotionsOf = ({
  layer,
  motion,
  busy,
}: {
  layer: Layer;
  motion: PartMotions | undefined;
  busy: string[];
}): OpenPoint[] => {
  if (!motion || STATELESS_LAYERS.includes(layer)) return [];

  const covered = (from: string, to: string) =>
    (motion.instant && from !== to) ||
    [...motion.motions, ...motion.unreachable].some((pair) => pair.from === from && pair.to === to);

  return motion.states.flatMap((from) =>
    motion.states.flatMap((to) => {
      const needed = from === to ? isOngoingWork(from, busy) : !from.includes('focus') && !to.includes('focus');

      return needed && !covered(from, to) ? [{ kind: 'missing-motion' as const, from, to }] : [];
    }),
  );
};

export type PartOpenPoints = { part: string; points: OpenPoint[] };

const rankOf = (point: OpenPoint) => OPEN_POINT_KINDS.indexOf(point.kind);

/** The open points of each part that has any, in the order of `parts`, each list in the order of `OPEN_POINT_KINDS`. */
export const openPointsOf = (input: OpenPointsInput): PartOpenPoints[] =>
  input.parts.flatMap(({ key, layer, controls, declaredNoControls, motion }) => {
    const stateful = !STATELESS_LAYERS.includes(layer);
    const points: OpenPoint[] = [
      ...(stateful && !controls && !declaredNoControls ? [{ kind: 'missing-state' as const, control: null }] : []),
      ...(stateful ? (input.missingStates ?? []) : [])
        .filter((missing) => missing.part === key)
        .map(({ control }) => ({ kind: 'missing-state' as const, control })),
      ...(input.contrasts ?? [])
        .filter((contrast) => contrast.part === key)
        .map(({ state, path }) => ({ kind: 'contrast' as const, state, path })),
      ...missingMotionsOf({
        layer,
        motion,
        busy: (input.busyStates ?? []).filter((busy) => busy.part === key).map(({ state }) => state),
      }),
      ...(input.directEdits ?? [])
        .filter((edit) => edit.part === key)
        .map(({ sketch }) => ({ kind: 'direct-edit' as const, sketch })),
      ...input.sketches
        .filter((sketch) => sketch.targets.includes(key))
        .map((sketch) => ({
          kind: 'unmerged-sketch' as const,
          sketch: sketch.name,
          primary: sketch.targets[0] === key,
          status: sketch.status,
          decision: sketch.decision,
        })),
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

const subjectOf = (point: OpenPoint) => {
  switch (point.kind) {
    case 'missing-state':
      return point.control ?? '';
    case 'contrast':
      return `${point.state} ${point.path}`;
    case 'missing-motion':
      return `${point.from} -> ${point.to}`;
    case 'open-comment':
      return point.comment;
    case 'direct-edit':
      return point.sketch ?? '';
    default:
      return '';
  }
};

const pointKeyOf = (part: string, point: OpenPoint) => `${part}\n${point.kind}\n${subjectOf(point)}`;

const groupedOf = (pairs: { part: string; point: OpenPoint }[]): PartOpenPoints[] =>
  [...new Set(pairs.map(({ part }) => part))].map((part) => ({
    part,
    points: pairs.filter((pair) => pair.part === part).map(({ point }) => point),
  }));

/**
 * Splits the open points of a sketch variant into the ones it adds and the ones the merged parts already have,
 * matched by part, kind and subject (control, state and path, or state pair). A part with no merged points adds all of
 * its points.
 */
export const sketchAddedPointsOf = (
  merged: PartOpenPoints[],
  sketched: PartOpenPoints[],
): { added: PartOpenPoints[]; inherited: PartOpenPoints[] } => {
  const before = new Set(merged.flatMap(({ part, points }) => points.map((point) => pointKeyOf(part, point))));
  const pairs = sketched.flatMap(({ part, points }) => points.map((point) => ({ part, point })));

  return {
    added: groupedOf(pairs.filter(({ part, point }) => !before.has(pointKeyOf(part, point)))),
    inherited: groupedOf(pairs.filter(({ part, point }) => before.has(pointKeyOf(part, point)))),
  };
};

const sketchText = (point: Extract<OpenPoint, { kind: 'unmerged-sketch' }>) => {
  const state =
    point.decision === 'pick'
      ? 'picked, not merged'
      : point.decision === 'discard'
        ? 'discarded, not removed'
        : point.status === 'ready'
          ? 'is ready, not merged'
          : 'is in progress - missing: sketch check, then sketch ready; the designer sees it only when ready';

  return `sketch ${point.sketch} ${state}${point.primary ? '' : ' (it also targets this part)'}`;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const missingStateText = (points: OpenPoint[]) => {
  const controls = points.flatMap((point) => (point.kind === 'missing-state' && point.control ? [point.control] : []));

  return [
    ...(controls.length < points.length ? ['no controls declared'] : []),
    ...(controls.length > 0 ? [`${plural(controls.length, 'missing state')} (${controls.join(', ')})`] : []),
  ].join('; ');
};

const contrastText = (points: OpenPoint[]) => {
  const states = [...new Set(points.map((point) => (point.kind === 'contrast' ? point.state : '')))];

  return `${plural(points.length, 'contrast')} under the rule (state${states.length === 1 ? '' : 's'} ${states.join(', ')})`;
};

const LISTED_MOTIONS = 6;

const loopEntriesOf = (states: string[]) =>
  states.map((state) => `${state}: { from: '${state}', to: '${state}' }`).join(', ');

const missingMotionText = (points: OpenPoint[]) => {
  const missing = points.flatMap((point) => (point.kind === 'missing-motion' ? [point] : []));
  const pairs = missing.filter(({ from, to }) => from !== to).map(({ from, to }) => `${from} -> ${to}`);
  const loops = missing.filter(({ from, to }) => from === to).map(({ from }) => from);
  const listed = pairs.slice(0, LISTED_MOTIONS).join(', ');
  const more = pairs.length > LISTED_MOTIONS ? `, +${pairs.length - LISTED_MOTIONS} more` : '';

  return [
    ...(pairs.length === 1 ? [`no motion ${pairs[0]}`] : []),
    ...(pairs.length > 1 ? [`${plural(pairs.length, 'missing motion')} (${listed}${more})`] : []),
    ...(loops.length > 0 ? [`no looping motion in ${loops.join(', ')} (add to motions: ${loopEntriesOf(loops)})`] : []),
  ].join('; ');
};

const groupText = (kind: OpenPointKind, points: OpenPoint[]) => {
  if (kind === 'missing-state') return missingStateText(points);

  if (kind === 'contrast') return contrastText(points);

  if (kind === 'missing-motion') return missingMotionText(points);

  if (kind === 'open-comment') {
    const ids = points.map((point) =>
      point.kind !== 'open-comment'
        ? ''
        : point.answered
          ? `${point.comment} addressed, waits on the user`
          : point.comment,
    );

    return `${ids.length} open comment${ids.length === 1 ? '' : 's'} (${ids.join(', ')})`;
  }

  if (kind === 'direct-edit')
    return points
      .map((point) =>
        point.kind === 'direct-edit' && point.sketch
          ? `changed outside a sketch - pick old or new in sketch ${point.sketch}`
          : 'changed outside a sketch - design check draws it',
      )
      .join('; ');

  return points.map((point) => (point.kind === 'unmerged-sketch' ? sketchText(point) : point.kind)).join('; ');
};

/** One text per kind of open point in `points`, in the order of `OPEN_POINT_KINDS`. */
export const openPointGroupsOf = (points: OpenPoint[]): string[] =>
  OPEN_POINT_KINDS.flatMap((kind) => {
    const ofKind = points.filter((point) => point.kind === kind);

    return ofKind.length > 0 ? [groupText(kind, ofKind)] : [];
  });

/** One header line with the total, then one line per part with its points, as `design check` prints them. */
export const openPointsText = (product: string, list: PartOpenPoints[]): string[] => {
  const total = list.reduce((sum, part) => sum + part.points.length, 0);

  if (total === 0) return [`OPEN POINTS ${product}: none`];

  return [
    `OPEN POINTS ${product}: ${total} in ${list.length} part${list.length === 1 ? '' : 's'}`,
    ...list.map(({ part, points }) => {
      return `  ${part}: ${openPointGroupsOf(points).join('; ')}`;
    }),
  ];
};
