import { DayRows, dayCheckOptions } from '../rows/build-rows';
import { CutOptions } from '../rows/cut';
import { CheckDayOptions, DEFAULT_ROUND_OPTIONS, DayCheck, RoundOptions, checkDay } from '../rows/round';
import { storedLaneKey } from '../rows/lane';
import { unnamedRowId } from '../rows/propose';
import { snapRowBounds } from '../rows/snap';
import { AttributionRule } from '../model/attribution';
import { streamKeyRepoPath } from '../model/block';
import { recutReviewedRows } from './recut';
import { formatDurationMs, formatTimeOfDay } from '../model/duration';
import { syncsWithoutReview } from '../model/evidence';
import { WorklogProposal, WorklogProposalState, syncsInState } from '../model/proposal';
import { StandIn, matchStandIn } from '../model/stand-in';
import { TimeWindow, subtractWindows } from '../model/time-window';
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

/** What the engine offered for one band: a proposal, or a band nothing could name. */
type RowSource = Omit<WorklogProposal, 'issueKey'> & { issueKey?: string; standInId?: string };

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
    override.issueKey !== undefined ||
    override.standInId !== undefined ||
    override.description !== undefined ||
    override.durationMs !== undefined;

  return {
    ...row,
    issueKey: override.issueKey ?? row.issueKey,
    standInId: override.standInId ?? row.standInId,
    description: override.description ?? row.description,
    durationMs: override.durationMs ?? row.durationMs,
    state: override.state ?? (changed ? 'edited' : defaultState(row)),
    edited: changed || override.state !== undefined,
    hidden: override.hidden === true,
    proposed,
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
});

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

  const standIn = standIns.find((entry) => entry.id === row.standInId);

  if (!standIn) return { ...row, standInId: undefined };
  if (standIn.state !== 'resolved' || !standIn.issueKey) return row;

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

  if (row.issueKey || row.standInId) return row;

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
const trackPinnedRows = (options: { pinned: readonly PinnedRow[]; sources: readonly RowSource[] }) => {
  const claimed = new Set<string>();
  const matched = new Map<string, string>();
  const known = new Set(options.sources.map((row) => row.id));

  const rows = options.pinned.map((pin) => {
    const lane = storedLaneKey(pin.laneKey);
    // A pin that lost every source has to claim by lane even where it tracks neither end, or the day
    // draws the stretch twice. The `replaces` test is what keeps a row added by hand out: it replaces
    // nothing, so it must stand beside the day's own rows rather than swallow one.
    const lostItsSources = pin.replaces.length > 0 && pin.replaces.every((id) => !known.has(id));

    if ((!pin.tracksFrom && !pin.tracksTo && !lostItsSources) || !lane) return pin;

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
      evidence: source.evidence,
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
 * A row books the time its band covers. One number reaches the reviewer, so a band drawn 13:15 to
 * 13:45 logs 30 minutes and never a shorter time the label would then have to explain. See ADR 0019.
 *
 * Run after `snapRowBounds`, whose bounds are whole increments, so this books whole increments too.
 */
const bookTheSpan = (rows: ReviewedRow[]): ReviewedRow[] =>
  rows.map((row) => {
    const durationMs = row.to.getTime() - row.from.getTime();

    return durationMs === row.durationMs ? row : { ...row, durationMs };
  });

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
  const edits = options.edits ?? EMPTY_DAY_REVIEW_EDITS;
  const standIns = options.standIns ?? [];
  const rules = options.rules ?? [];
  const tracked = trackPinnedRows({
    pinned: edits.pinned,
    sources: [...options.rows.proposals, ...options.rows.unnamed],
  });
  const consumed = new Set([...edits.pinned.flatMap((row) => [row.id, ...row.replaces]), ...tracked.matched.values()]);
  const reviewed = [
    ...options.rows.proposals
      .filter((proposal) => !consumed.has(proposal.id))
      .map((proposal) => withOverride(proposal, edits.overrides[proposal.id])),
    ...options.rows.unnamed
      .filter((row) => !consumed.has(row.id))
      .map((row) => withOverride(row, edits.overrides[row.id])),
    ...tracked.rows.map(fromPinned).map((row) => nameFromStandInRule({ row, rules, standIns })),
    ...tracked.leftovers.map((row) => withOverride(row, edits.overrides[row.id])),
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
    round: options.round,
  });
  const rows = bookTheSpan(recut.rows);

  const replacedMs = options.rows.proposals
    .filter((proposal) => consumed.has(proposal.id))
    .reduce((sum, proposal) => sum + proposal.observedMs, 0);
  const pinnedMs = tracked.rows.reduce((sum, row) => sum + row.observedMs, 0);
  const unreconciledMs = Math.max(0, replacedMs - pinnedMs);

  /**
   * The bands the reviewer has answered: named, given a stand-in, hidden, or consumed by a row they
   * built. Each is drawn with that answer on it, so counting it as time nothing named would report a
   * band the screen does not show and book the same minutes twice over.
   */
  const settled = new Set([
    ...consumed,
    ...reviewed.filter((row) => !!row.issueKey || !!row.standInId || row.hidden).map((row) => row.id),
  ]);

  const check = checkDay({
    proposals: rows.filter(isNamedRow).filter((row) => syncsInState(row.state)),
    unattributed: options.rows.unattributed.filter((group) => !settled.has(unnamedRowId(group))),
    options: { ...dayCheckOptions(options.rows), ...options.check },
  });

  return {
    rows,
    hidden,
    behind: recut.behind,
    check: withOverlaps({
      check: withStaleEdits({
        check: withDrift({ check, unreconciledMs, options: options.check }),
        rows: options.rows,
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
 */
const withOverlaps = (options: {
  check: DayCheck;
  rows: readonly ReviewedRow[];
  options?: CheckDayOptions;
}): DayCheck => {
  const tolerance = options.options?.toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const writes = options.rows.filter(isNamedRow).filter((row) => syncsInState(row.state));
  const pairs = writes
    .flatMap((left, at) =>
      writes.slice(at + 1).map((right) => ({
        left,
        right,
        overlapMs: overlapMs(left, right),
        from: new Date(Math.max(left.from.getTime(), right.from.getTime())),
      })),
    )
    .filter((pair) => (pair.left.edited || pair.right.edited) && pair.overlapMs >= tolerance);

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
