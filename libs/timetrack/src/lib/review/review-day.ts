import { DayRows, dayCheckOptions } from '../rows/build-rows';
import { RemoteBooking, bookedSpanMs, unbookedRemoteByRow } from '../rows/remote-booking';
import { CutOptions } from '../rows/cut';
import {
  CheckDayOptions,
  DEFAULT_ROUND_OPTIONS,
  DayCheck,
  RoundOptions,
  checkDay,
  sharingTicket,
  siblingBookingsOf,
} from '../rows/round';
import { CALL_LANE_KEY, storedLaneKey } from '../rows/lane';
import { UnnamedProposal, unnamedRowId } from '../rows/propose';
import { describeWork } from '../rows/describe';
import { snapRowBounds } from '../rows/snap';
import { AttributionRule } from '../model/attribution';
import { streamKeyRepoPath } from '../model/block';
import { foldCrowdedSiblings, foldShortRows } from './fold';
import { describeCallPiece } from './call-pieces';
import { backgroundTest, recutReviewedRows } from './recut';
import { formatDurationMs, formatTimeOfDay } from '../model/duration';
import { Evidence, syncsWithoutReview } from '../model/evidence';
import { WorklogProposal, WorklogProposalState, syncsInState } from '../model/proposal';
import { StandIn, findStandIn, matchStandIn } from '../model/stand-in';
import { TimeWindow, subtractWindows, windowsMs } from '../model/time-window';
import {
  DayReview,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  PinnedRow,
  ProposalOverride,
  NamedRow,
  ReviewedRow,
  isNamedRow,
} from './model';
import { isManualRow } from './edits';
import { autoDisputeSettles } from './auto-dispute';
import { foldEndedRests } from './end-call';
import { mayAutoWrite, rowFieldSourceOf, storedSourceOf } from '../model/field-source';

/** What the engine offered for one band: a proposal, or a band nothing could name. */
type RowSource = Omit<WorklogProposal, 'issueKey'> & { issueKey?: string; standInId?: string; folded?: string[] };

const MOST_PARALLEL_SIBLINGS = 3;

/**
 * The state an untouched row reviews in. A well-evidenced row is accepted on sight — asking for a
 * click on every certain row is what makes a reviewer stop reading them — while a weak one stays
 * `suggested` until somebody says otherwise, and so never syncs.
 *
 * A row with no issue is never accepted on sight however well evidenced it is. There is nothing to
 * accept: it says a stretch of work happened, not what it was for.
 */
const defaultState = (row: RowSource): WorklogProposalState =>
  row.issueKey && syncsWithoutReview(row.confidence) ? 'accepted' : 'suggested';

const withOverride = (row: RowSource, override: ProposalOverride | undefined): ReviewedRow => {
  const proposed = row.issueKey ? { ...row, issueKey: row.issueKey } : undefined;

  if (!override) return { ...row, state: defaultState(row), edited: false, hidden: false };

  const changed =
    override.issueKey !== undefined || override.standInId !== undefined || override.description !== undefined;

  // An override that names a placeholder names no issue. The form blanks its issue field to say so,
  // and an empty key is not `undefined`, so without this it wins the `??` below and the row reads
  // with no name at all.
  const named = override.standInId
    ? { issueKey: undefined, standInId: override.standInId }
    : { issueKey: override.issueKey ?? row.issueKey, standInId: row.standInId };
  const issueSource = storedSourceOf({
    set: override.issueKey !== undefined || override.standInId !== undefined,
    source: override.sources?.issue,
  });
  const namedByHand = issueSource === 'human' && !override.standInId && !!override.issueKey;
  const { disputedIssueKey: _disputedIssueKey, disputedStandInId: _disputedStandInId, ...undisputed } = row;

  return {
    ...(issueSource === 'human' ? undisputed : row),
    ...named,
    ...(namedByHand ? { confidence: 'certain' as const } : {}),
    description: override.description ?? row.description,
    state: override.state ?? (changed ? 'edited' : defaultState(row)),
    edited: changed || override.state !== undefined,
    hidden: override.hidden === true,
    proposed,
    sources: {
      issue: issueSource,
      description: storedSourceOf({ set: override.description !== undefined, source: override.sources?.description }),
    },
  };
};

const fromPinned = (row: PinnedRow): ReviewedRow => ({
  id: row.id,
  issueKey: row.issueKey,
  standInId: row.standInId,
  storyKey: row.storyKey,
  from: row.from,
  to: row.to,
  durationMs: row.durationMs,
  observedMs: row.observedMs,
  laneKey: storedLaneKey(row.laneKey),
  description: row.description,
  confidence: row.confidence,
  evidence: row.evidence,
  excluded: row.excluded,
  unattended: row.unattended,
  withheldIssueKey: row.withheldIssueKey,
  state: row.state ?? 'edited',
  edited: true,
  hidden: row.hidden === true,
  sources: {
    issue: storedSourceOf({ set: !!row.issueKey || !!row.standInId, source: row.sources?.issue }),
    description: storedSourceOf({ set: !!row.description, source: row.sources?.description }),
  },
});

// A call row is left to `describeCallPiece`, which only recognises a description it wrote itself.
const describeOwnSpan = (row: ReviewedRow): ReviewedRow => {
  if (storedLaneKey(row.laneKey) === CALL_LANE_KEY || !mayAutoWrite(rowFieldSourceOf(row, 'description'))) return row;

  const group = { ...row, evidence: [], blocks: [] };
  const evidence = row.evidence.filter((entry) => entry.at >= row.from && entry.at <= row.to);
  const description = describeWork({ group: { ...group, evidence } });

  if (description === describeWork({ group }) || description === row.description) return row;

  return { ...row, description };
};

const evidenceWithinPin = (options: { evidence: readonly Evidence[]; pin: PinnedRow; from: Date; to: Date }) =>
  options.evidence.filter(
    (entry) => (options.pin.tracksFrom || entry.at >= options.from) && (options.pin.tracksTo || entry.at < options.to),
  );

/**
 * Reads a row's stand-in against the records that exist now.
 *
 * A resolve rewrites the rules that named the stand-in and never a stored day, so a row named to one
 * in that day's own edits would otherwise keep pointing at a record that has since become an issue —
 * and its override also blanks `issueKey`, so the key the rewritten rule puts on the block underneath
 * would not reach it either. A row pointing at a record that is gone reads as unnamed, which is what
 * `attribute` already does for a rule naming a deleted stand-in.
 */
const readStandIn = (row: ReviewedRow, standIns: readonly StandIn[]): ReviewedRow => {
  if (!row.standInId) return row;

  const standIn = findStandIn({ id: row.standInId, standIns });

  if (!standIn) return { ...row, standInId: undefined };
  if (standIn.state !== 'resolved' || !standIn.issueKey)
    return standIn.id === row.standInId ? row : { ...row, standInId: standIn.id };

  return { ...row, standInId: undefined, issueKey: standIn.issueKey };
};

/**
 * Names a row the reviewer built with the stand-in covering the checkout it sits in.
 *
 * A pinned row holds the structure the reviewer gave it and never passes the ladder again, so the rule
 * the app writes when it opens a placeholder reaches every day except the ones they already answered.
 * Only an open stand-in is read: it books nothing, where a key would put a row nobody reviewed into
 * the sync.
 */
const nameFromStandInRule = (options: {
  row: ReviewedRow;
  rules: readonly AttributionRule[];
  standIns: readonly StandIn[];
}): ReviewedRow => {
  const { row } = options;

  if (row.issueKey || row.standInId || !mayAutoWrite(rowFieldSourceOf(row, 'issue'))) return row;

  const repoPath = row.laneKey ? streamKeyRepoPath(row.laneKey) : undefined;

  if (!repoPath) return row;

  const standIn = matchStandIn({ context: { repoPath }, rules: options.rules, standIns: options.standIns });

  return standIn?.state === 'open' ? { ...row, standInId: standIn.id } : row;
};

const overlapMs = (a: { from: Date; to: Date }, b: { from: Date; to: Date }) =>
  Math.min(a.to.getTime(), b.to.getTime()) - Math.max(a.from.getTime(), b.from.getTime());

const spanMs = (window: { from: Date; to: Date }) => window.to.getTime() - window.from.getTime();

/** The share of a band's observed time that falls inside one window of it. */
const sharedObservedMs = (options: { source: RowSource; window: TimeWindow }) => {
  const whole = spanMs(options.source);

  if (whole <= 0) return options.source.observedMs;

  const shared = Math.max(
    0,
    Math.min(options.source.to.getTime(), options.window.to.getTime()) -
      Math.max(options.source.from.getTime(), options.window.from.getTime()),
  );

  return Math.round((options.source.observedMs * shared) / whole);
};

/** The stretches a window holds of a band's own stretches, so a piece draws no band outside itself. */
const clipStretches = (stretches: readonly TimeWindow[] | undefined, window: TimeWindow) =>
  stretches
    ?.map((stretch) => ({
      from: new Date(Math.max(stretch.from.getTime(), window.from.getTime())),
      to: new Date(Math.min(stretch.to.getTime(), window.to.getTime())),
    }))
    .filter((stretch) => stretch.to.getTime() > stretch.from.getTime());

/**
 * The stretches of the day's own band that no pinned row claiming it covers, as rows of their own.
 *
 * A pin takes the whole band it matched. Without these, shortening a row deletes whatever the band
 * held outside it, and a band that is still growing — a voice room left open — stops on screen until
 * the collector behind it restarts and opens a second band. Each stretch keeps the band's own marks,
 * so a room a rule excluded is still drawn as excluded.
 *
 * Every pin of the lane is subtracted rather than only the one that matched, or a split whose halves
 * re-claim their band by lane would have one half redraw the other.
 *
 * A stretch comes back unnamed. The reviewer shortened a row to say those minutes were not that work,
 * so handing them back under its issue would book the time they just took off it.
 */
const leftoverRows = (options: {
  rows: readonly PinnedRow[];
  matched: ReadonlyMap<string, string>;
  sources: readonly RowSource[];
}): RowSource[] => {
  const taken = new Set(options.matched.values());

  return options.sources
    .filter((source) => taken.has(source.id))
    .flatMap((source) => {
      const lane = storedLaneKey(source.laneKey);
      const covered = options.rows.filter((row) => storedLaneKey(row.laneKey) === lane);

      return subtractWindows({ windows: [{ from: source.from, to: source.to }], without: covered }).map(
        (window, at): RowSource => ({
          ...source,
          id: `${source.id}#${at + 2}`,
          issueKey: undefined,
          standInId: undefined,
          storyKey: undefined,
          from: window.from,
          to: window.to,
          durationMs: spanMs(window),
          observedMs: sharedObservedMs({ source, window }),
          stretches: clipStretches(source.stretches, window),
          confidence: 'weak',
          state: 'suggested',
        }),
      );
    });
};

/**
 * Takes the ends a reviewer never set from the engine's row for the same lane, and reports which
 * engine row each pinned row now stands for.
 *
 * A proposal's id carries its start, so a sliver of other work appearing in front of a band gives the
 * band a new id and `replaces` stops finding it. Matching on the lane instead is what keeps a row
 * whose start was dragged following a day that is still being worked.
 *
 * An engine row is claimed by one pinned row only, so the two halves of a split can never both grow
 * onto the same band.
 */
const trackPinnedRows = (options: {
  pinned: readonly PinnedRow[];
  sources: readonly RowSource[];
  /** Pins that claim their lane's band although they track neither end. */
  claiming?: ReadonlySet<string>;
}) => {
  const claimed = new Set<string>();
  const matched = new Map<string, string>();
  const known = new Set(options.sources.map((row) => row.id));

  const rows = options.pinned.map((pin) => {
    const lane = storedLaneKey(pin.laneKey);
    // A pin that lost every source has to claim by lane even where it tracks neither end, or the day
    // draws the stretch twice. The `replaces` test is what keeps a row added by hand out: it replaces
    // nothing, so it must stand beside the day's own rows rather than swallow one.
    const lostItsSources = pin.replaces.length > 0 && pin.replaces.every((id) => !known.has(id));
    const claims = lostItsSources || !!options.claiming?.has(pin.id);

    if ((!pin.tracksFrom && !pin.tracksTo && !claims) || !lane) return pin;

    const [source] = options.sources
      .filter((row) => !claimed.has(row.id) && storedLaneKey(row.laneKey) === lane && overlapMs(row, pin) > 0)
      .sort((a, b) => overlapMs(b, pin) - overlapMs(a, pin));

    if (!source) return pin;

    if (!pin.tracksFrom && !pin.tracksTo) {
      claimed.add(source.id);
      matched.set(pin.id, source.id);

      return pin;
    }

    const from = pin.tracksFrom ? source.from : pin.from;
    const to = pin.tracksTo ? source.to : pin.to;

    if (to.getTime() <= from.getTime()) return pin;

    claimed.add(source.id);
    matched.set(pin.id, source.id);

    return {
      ...pin,
      from,
      to,
      durationMs: to.getTime() - from.getTime(),
      observedMs: sharedObservedMs({ source, window: { from, to } }),
      evidence: evidenceWithinPin({ evidence: source.evidence, pin, from, to }),
      // The band still says what it is, so the marks come off it rather than off the stored edit: a
      // rule the user has since changed reaches the row, and a row pinned before the day carried them
      // is not left reading as work nobody named.
      excluded: source.excluded,
      unattended: source.unattended,
      withheldIssueKey: source.withheldIssueKey,
    };
  });

  return { rows, matched, leftovers: leftoverRows({ rows, matched, sources: options.sources }) };
};

/**
 * The bands lying inside the rows the reviewer built from the day's own bands, lane by lane. A pin
 * names its bands by an id holding the start the merge gave them, so a lane the merge now cuts
 * differently comes back under ids no pin names; the pin still wins. A band reaching past the pinned
 * span holds time observed after the pin, and is drawn.
 */
const coveredByPins = (options: {
  pinned: readonly PinnedRow[];
  sources: readonly RowSource[];
  incrementMs: number;
}): Set<string> => {
  const built = options.pinned.filter((pin) => pin.replaces.length > 0 && !!storedLaneKey(pin.laneKey));

  return new Set(
    options.sources
      .filter((source) => {
        const lane = storedLaneKey(source.laneKey);
        const pins = built.filter((pin) => storedLaneKey(pin.laneKey) === lane);

        if (!lane || !pins.length) return false;

        const outside = subtractWindows({ windows: [{ from: source.from, to: source.to }], without: pins });

        return windowsMs(outside) < options.incrementMs;
      })
      .map((source) => source.id),
  );
};

const idStartOf = (id: string) => id.slice(id.lastIndexOf('@') + 1);

const idBaseOf = (id: string) => id.slice(0, id.lastIndexOf('@'));

const startsWithin = (id: string, row: TimeWindow) => {
  const start = Date.parse(idStartOf(id));

  return start >= row.from.getTime() && start < row.to.getTime();
};

/**
 * Gives a row back the id an edit of the reviewer's still hangs on, so an answer the day learns for a
 * band later never drops what they said. A proposal takes the id it carried while unnamed. Any row
 * takes the id of a band of its lane and start the reviewer named by hand, where no row carries that
 * id any more: a rule the day learns later changes the id, and the reviewer's name still wins. And a
 * row whose start moved takes the edited id of the same issue or lane whose start it now covers.
 */
const onEditedIds = (options: {
  proposals: readonly WorklogProposal[];
  unnamed: readonly UnnamedProposal[];
  edits: DayReviewEdits;
  pinnedIds: ReadonlySet<string>;
}): { proposals: WorklogProposal[]; unnamed: UnnamedProposal[]; formerIds: Map<string, string> } => {
  const { overrides } = options.edits;
  const taken = new Set([...options.proposals, ...options.unnamed].map((row) => row.id));
  const edited = (id: string) => !!overrides[id] || options.pinnedIds.has(id);
  const formerIds = new Map<string, string>();

  const proposals = options.proposals.map((row) => {
    const id = row.unnamedId;

    if (!id || taken.has(id) || edited(row.id) || !edited(id)) return row;

    taken.add(id);

    return { ...row, id };
  });

  const orphans = Object.entries(overrides).filter(
    ([id, override]) =>
      !taken.has(id) &&
      !options.pinnedIds.has(id) &&
      !!override.laneKey &&
      !!(override.issueKey || override.standInId) &&
      storedSourceOf({ set: true, source: override.sources?.issue }) === 'human',
  );

  const reclaim = <T extends WorklogProposal | UnnamedProposal>(row: T): T => {
    if (edited(row.id)) return row;

    const lane = storedLaneKey(row.laneKey);
    const start = idStartOf(row.id);
    const found = orphans.filter(
      ([id, override]) => !taken.has(id) && storedLaneKey(override.laneKey) === lane && idStartOf(id) === start,
    );
    const moved = Object.keys(overrides).filter(
      (id) =>
        !taken.has(id) && !options.pinnedIds.has(id) && idBaseOf(id) === idBaseOf(row.id) && startsWithin(id, row),
    );
    const id = found.length === 1 ? found[0]?.[0] : moved.length === 1 ? moved[0] : undefined;

    if (!id) return row;

    taken.add(id);
    formerIds.set(id, row.id);

    return { ...row, id };
  };

  return { proposals: proposals.map(reclaim), unnamed: options.unnamed.map(reclaim), formerIds };
};

/**
 * A row books the time its band covers. One number reaches the reviewer, so a band drawn 13:15 to
 * 13:45 logs 30 minutes and never a shorter time the label would then have to explain. See ADR 0019.
 * The exceptions are remote time past the day's allowance, which ADR 0033 draws and never books, and
 * the rows of two agent sessions on one ticket, which share their observed minutes out (`siblingBookingsOf`);
 * a row the reviewer wrote by hand books its span regardless.
 *
 * Run after `snapRowBounds`, whose bounds are whole increments, so this books whole increments too.
 */
const bookTheSpan = (options: {
  rows: ReviewedRow[];
  remote?: RemoteBooking;
  round?: Partial<RoundOptions>;
}): ReviewedRow[] => {
  const { rows } = options;
  const observed = rows.filter((row) => !isManualRow(row));
  const unbooked = unbookedRemoteByRow({ rows: observed, remote: options.remote });
  const siblings = siblingBookingsOf(observed, {
    spanMsOf: (row) => bookedSpanMs(row, unbooked[observed.indexOf(row)] ?? []),
    round: options.round,
  });

  return rows.map((row) => {
    const windows = unbooked[observed.indexOf(row)] ?? [];
    const durationMs = siblings.get(row) ?? bookedSpanMs(row, windows);
    const unbookedMs = windowsMs(windows) || undefined;

    if (durationMs === row.durationMs && unbookedMs === row.unbookedMs) return row;

    const { unbookedMs: _stale, ...rest } = row;

    return unbookedMs ? { ...rest, durationMs, unbookedMs } : { ...rest, durationMs };
  });
};

/**
 * Applies a day's local edits to a freshly correlated day and reports what a sync would write.
 *
 * Edits always win. A proposal a split or a merge consumed is dropped rather than re-appearing beside
 * the row the reviewer built from it, so re-running the engine over a day — which happens on every
 * collector tick — can never resurrect a row somebody has already dealt with. What it can do is
 * observe *more* time under such a row, and that surplus is reported as `unreconciledMs` instead of
 * being folded in silently: the reviewer's numbers are theirs, but the day should still say so.
 */
export const reviewDay = (options: {
  rows: DayRows;
  edits?: DayReviewEdits;
  check?: CheckDayOptions;
  round?: Partial<RoundOptions>;
  /** The same cut the day was built with, so a reviewer's edit is cut by the rule the machine used. */
  cut?: CutOptions;
  /** Every stand-in the settings hold, so a row named to one reads the answer it has since been given. */
  standIns?: readonly StandIn[];
  /** The standing rules, so a row the reviewer built still follows the one that covers its checkout. */
  rules?: readonly AttributionRule[];
}): DayReview => {
  const { edits, ended } = foldEndedRests(options.edits ?? EMPTY_DAY_REVIEW_EDITS);
  const standIns = options.standIns ?? [];
  const rules = options.rules ?? [];
  const pinnedIds = new Set(edits.pinned.flatMap((row) => [row.id, ...row.replaces]));
  const isBackground = backgroundTest(options.cut?.backgroundProjects);
  const incrementMs = { ...DEFAULT_ROUND_OPTIONS, ...options.round }.incrementMs;
  const { proposals, unnamed, formerIds } = onEditedIds({
    proposals: options.rows.proposals,
    unnamed: options.rows.unnamed,
    edits,
    pinnedIds,
  });
  const handedOverTo = (grower: RowSource, other: TimeWindow & { laneKey?: string }) =>
    other.laneKey !== grower.laneKey &&
    (options.rows.handedOver?.[grower.laneKey ?? ''] ?? []).some(
      (window) => window.from < other.to && other.from < window.to,
    );
  const sources = foldShortRows<RowSource>({
    rows: foldCrowdedSiblings<RowSource>({
      rows: [...proposals, ...unnamed],
      most: MOST_PARALLEL_SIBLINGS,
      incrementMs,
      fixed: (row) => pinnedIds.has(row.id),
      canFold: (row) => !edits.overrides[row.id],
    }),
    incrementMs,
    fixed: (row) => pinnedIds.has(row.id),
    canFold: (row) => !edits.overrides[row.id],
    blockers: edits.pinned.filter((row) => !row.hidden),
    // The re-cut below hands a background row's minutes to any foreground row over them, so a growth
    // across that divide would take minutes a background row books, or be cut away again.
    collides: (grower, other) => isBackground(grower) !== isBackground(other) || handedOverTo(grower, other),
    startsAtEarliest: (row) => storedLaneKey(row.laneKey) === CALL_LANE_KEY,
  });
  const tracked = trackPinnedRows({ pinned: edits.pinned, sources, claiming: ended });
  const calls = options.rows.calls;
  const answered = new Set([...pinnedIds, ...tracked.matched.values()]);
  const covered = coveredByPins({
    pinned: tracked.rows,
    sources: sources.filter((row) => !answered.has(row.id)),
    incrementMs,
  });
  const consumed = new Set([...answered, ...covered]);
  const settledRow = <T extends RowSource>(row: T): T => {
    if (!autoDisputeSettles({ edits, row })) return row;

    const { disputedIssueKey: _disputedIssueKey, disputedStandInId: _disputedStandInId, ...undisputed } = row;

    return undisputed as T;
  };
  const reviewed = [
    ...sources
      .filter((row) => !consumed.has(row.id))
      .map((row) => withOverride(settledRow(row), edits.overrides[row.id])),
    ...tracked.rows
      .map((pin) => {
        const row = describeOwnSpan(fromPinned(pin));

        return pin.replaces.length ? describeCallPiece({ row, calls }) : row;
      })
      .map((row) => nameFromStandInRule({ row, rules, standIns })),
    ...tracked.leftovers.map((row) =>
      withOverride(settledRow(describeCallPiece({ row, calls })), edits.overrides[row.id]),
    ),
  ]
    .map((row) => readStandIn(row, standIns))
    .sort((a, b) => a.from.getTime() - b.from.getTime() || (a.issueKey ?? '').localeCompare(b.issueKey ?? ''));

  const hidden = reviewed.filter((row) => row.hidden);
  // After the snap, so a background row gives up whole increments, and before the span is booked, so
  // what it gives up leaves its worklog too.
  const recut = recutReviewedRows({
    rows: snapRowBounds({ rows: reviewed.filter((row) => !row.hidden), options: options.round }),
    behind: options.rows.behind,
    backgroundProjects: options.cut?.backgroundProjects,
    focusMsByStream: options.cut?.focusMsByStream,
    stated: new Set(edits.pinned.filter((row) => !row.replaces.length).map((row) => row.id)),
    round: options.round,
  });
  const rows = bookTheSpan({ rows: recut.rows, remote: options.rows.remote, round: options.round });

  const replacedMs = proposals
    .filter((proposal) => answered.has(proposal.id))
    .reduce((sum, proposal) => sum + proposal.observedMs, 0);
  const proposalIds = new Set(proposals.map((proposal) => proposal.id));
  const pinnedMs = tracked.rows
    .filter((pin) => [pin.id, ...pin.replaces, tracked.matched.get(pin.id)].some((id) => !!id && proposalIds.has(id)))
    .reduce((sum, row) => sum + row.observedMs, 0);
  const unreconciledMs = Math.max(0, replacedMs - pinnedMs);

  /**
   * The bands the reviewer has answered: named, given a stand-in, hidden, not to be logged, or consumed
   * by a row they built. Each is drawn with that answer on it, so counting it as time nothing named would report a
   * band the screen does not show and book the same minutes twice over.
   */
  const answeredIds = [
    ...consumed,
    ...reviewed
      .filter((row) => !!row.issueKey || !!row.standInId || row.hidden || row.state === 'rejected')
      .map((row) => row.id),
  ];
  const settled = new Set([...answeredIds, ...answeredIds.flatMap((id) => formerIds.get(id) ?? [])]);

  const check = checkDay({
    proposals: rows.filter(isNamedRow).filter((row) => syncsInState(row.state)),
    unattributed: options.rows.unattributed.flatMap((group) => {
      const id = unnamedRowId(group);

      if (!settled.has(id)) return [group];

      const left = reviewed.filter(
        (row) =>
          row.id.startsWith(`${id}#`) && !row.issueKey && !row.standInId && !row.hidden && row.state !== 'rejected',
      );

      return left.length ? [{ ...group, observedMs: left.reduce((sum, row) => sum + row.observedMs, 0) }] : [];
    }),
    options: { ...dayCheckOptions(options.rows), ...options.check },
  });

  return {
    rows,
    hidden,
    behind: recut.behind,
    check: withOverlaps({
      check: withStaleEdits({
        check: withDrift({ check, unreconciledMs, options: options.check }),
        rows: { ...options.rows, proposals, unnamed },
        edits,
        matched: tracked.matched,
      }),
      rows,
      options: options.check,
    }),
    unreconciledMs,
  };
};

/**
 * Warns about an edited row the engine can no longer reconcile, which a change to the row pipeline
 * leaves behind: a pinned row names the proposals it consumed by id, and an id holds the issue key and
 * the start those proposals had. Once the engine cuts the day differently, none of them exist, so the
 * reviewer's row and the new proposal are both shown and the day silently books the time twice.
 *
 * Only a pinned row that lost every source is reported. One that kept one, or that `trackPinnedRows`
 * re-attached to a row in its lane, still reconciles.
 */
const withStaleEdits = (options: {
  check: DayCheck;
  rows: DayRows;
  edits: DayReviewEdits;
  matched: ReadonlyMap<string, string>;
}): DayCheck => {
  const known = new Set([...options.rows.proposals.map((row) => row.id), ...options.rows.unnamed.map((row) => row.id)]);
  const stale = options.edits.pinned.filter(
    (row) => !options.matched.has(row.id) && row.replaces.length > 0 && row.replaces.every((id) => !known.has(id)),
  );

  if (!stale.length) return options.check;

  return {
    ...options.check,
    warnings: [
      ...options.check.warnings,
      {
        kind: 'stale-edit',
        detail: `${stale.length} row${stale.length === 1 ? '' : 's'} you edited no longer match what the day proposes; reset to take the new rows`,
      },
    ],
  };
};

/** What a pair of rows claiming the same minutes reads as: how long, which two rows, and from when. */
const overlapDetail = (pairs: readonly { left: NamedRow; right: NamedRow; overlapMs: number; from: Date }[]) =>
  [...pairs]
    .sort((left, right) => right.overlapMs - left.overlapMs)
    .map(
      (pair) =>
        `${formatDurationMs(pair.overlapMs)} from ${formatTimeOfDay(pair.from)} under both ${pair.left.issueKey} and ${pair.right.issueKey}`,
    )
    .join(', ');

/**
 * Warns where two rows a sync would write cover the same minutes, which is time the day books twice.
 *
 * Only a pair the reviewer had a hand in is reported. The machine's own overlaps are the day running
 * two things at once, which `concurrency` and `meeting-overlap` already say; a pair left over after
 * the re-cut is instead the one thing no rule resolved, and nothing else on the screen names it.
 * A pair with a call row is expected: a sync books call rows apart from code rows. So is the pair of two
 * sessions' rows on one ticket, which book their own minutes rather than their spans.
 */
const withOverlaps = (options: {
  check: DayCheck;
  rows: readonly ReviewedRow[];
  options?: CheckDayOptions;
}): DayCheck => {
  const tolerance = options.options?.toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const writes = options.rows
    .filter(isNamedRow)
    .filter((row) => syncsInState(row.state) && storedLaneKey(row.laneKey) !== CALL_LANE_KEY);
  const pairs = writes
    .flatMap((left, at) =>
      writes.slice(at + 1).map((right) => ({
        left,
        right,
        overlapMs: overlapMs(left, right),
        from: new Date(Math.max(left.from.getTime(), right.from.getTime())),
      })),
    )
    .filter((pair) => (pair.left.edited || pair.right.edited) && pair.overlapMs >= tolerance)
    .filter((pair) => !sharingTicket([pair.left, pair.right]).size);

  if (!pairs.length) return options.check;

  return {
    ...options.check,
    warnings: [...options.check.warnings, { kind: 'rows-overlap', detail: overlapDetail(pairs) }],
  };
};

const withDrift = (options: { check: DayCheck; unreconciledMs: number; options?: CheckDayOptions }): DayCheck => {
  const tolerance = options.options?.toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;

  if (options.unreconciledMs < tolerance) return options.check;

  return {
    ...options.check,
    warnings: [
      ...options.check.warnings,
      {
        kind: 'edited-row-drift',
        detail: `${formatDurationMs(options.unreconciledMs)} of new evidence landed under a row you edited`,
      },
    ],
  };
};
