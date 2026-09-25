import { TimeWindow } from '../model/time-window';
import { ActivityBlock, streamKey } from '../model/block';
import { CollectedEvent } from '../model/event';
import { projectKeyOf } from '../ticket/project';
import { AttributedBlock } from './attribute';
import { clipBlocks } from './overlap';
import { DEFAULT_ROUND_OPTIONS, RoundOptions } from './round';
import { watchPrompts, watchedAt } from './watched';

export type CutOptions = {
  /**
   * The Jira projects whose work runs behind the day rather than being it — the checkout a person is
   * in all day while the work they are booking happens elsewhere. Keys, as `favoriteProjects` holds
   * them.
   */
  backgroundProjects?: readonly string[];
  /**
   * Focused milliseconds per `streamKey`, from the day's own focus spans. It ranks two background
   * bands against each other, and nothing else reads it.
   */
  focusMsByStream?: Readonly<Record<string, number>>;
  /**
   * The focused window's time per `streamKey`, from the same spans. It decides which of a checkout and
   * its linked worktrees keeps an instant both held — see `cutUnwatched`.
   */
  focusByStream?: Readonly<Record<string, readonly TimeWindow[]>>;
  /**
   * Windows the day already holds as work outside its blocks — the calls a rule counts as work. A
   * meeting is the foreground of the minutes it runs in, and it carries no block for the cut to read
   * it off, so it has to be handed in.
   */
  claimed?: readonly TimeWindow[];
  /** The increment the day's clock times sit on, which a reported stretch is snapped to. */
  round?: Partial<RoundOptions>;
  /**
   * The instant a day still being collected is read through. A background band claims nothing from the
   * increment this instant falls in.
   *
   * That increment is not over, so the checkout that ends up holding its foreground cannot have
   * declared itself yet. A background band that took it books a whole increment which the work beside
   * it claims a minute later, and on the way there the row stands accepted and ready to sync.
   *
   * A day that is over is read through its own end, which is after every block it holds and cuts
   * nothing.
   */
  through?: Date;
};

const windowOf = (entry: AttributedBlock): TimeWindow => ({ from: entry.block.from, to: entry.block.to });

/** The parts of a block the given windows leave, each keeping the evidence observed inside it. */
const piecesOf = (entry: AttributedBlock, windows: readonly TimeWindow[]): AttributedBlock[] =>
  clipBlocks({ blocks: [entry.block], windows }).map((block) => ({
    ...entry,
    block,
    evidence: entry.evidence.filter(
      (observed) => observed.at.getTime() >= block.from.getTime() && observed.at.getTime() <= block.to.getTime(),
    ),
  }));

/** The start of the increment an instant falls in: everything before it is an increment already over. */
const settledThrough = (options: { through?: Date; round?: Partial<RoundOptions> }) => {
  if (!options.through) return Number.POSITIVE_INFINITY;

  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };

  return Math.floor(options.through.getTime() / incrementMs) * incrementMs;
};

/** The part of a block that falls in an increment already over, or none where no part does. */
const settledPart = (entry: AttributedBlock, through: number): AttributedBlock | undefined => {
  if (entry.block.to.getTime() <= through) return entry;

  const [block] = clipBlocks({ blocks: [entry.block], windows: [{ from: new Date(through), to: entry.block.to }] });

  if (!block) return undefined;

  return { ...entry, block, evidence: entry.evidence.filter((observed) => observed.at.getTime() <= through) };
};

/**
 * A stretch a background band lost to a foreground band.
 *
 * The minutes are real work and another band already claims them, so they are neither booked nor
 * waiting to be named. They are reported rather than dropped because the day screen draws one lane per
 * checkout: without them the lane holds a hole nothing on the screen explains.
 *
 * `issueKey` is the key the band would have booked, and it sits here rather than on a row because a
 * row's `issueKey` is what writes time to Tempo.
 */
export type BehindStretch = {
  from: Date;
  to: Date;
  issueKey: string;
  /** The checkout the band ran in, which is the lane it is drawn in. */
  laneKey: string;
  /**
   * How much of the span the ticket really lost, where the stretch was joined across time it lost
   * none of. Absent, it lost the whole span.
   */
  durationMs?: number;
};

export type CutResult = {
  blocks: AttributedBlock[];
  behind: BehindStretch[];
};

/** The stretches of a block that the pieces kept from it no longer cover, in order. */
const holesOf = (options: { block: ActivityBlock; kept: readonly ActivityBlock[] }): TimeWindow[] => {
  const end = options.block.to.getTime();
  const ordered = [...options.kept].sort((a, b) => a.from.getTime() - b.from.getTime());
  const holes: TimeWindow[] = [];

  let at = options.block.from.getTime();

  for (const piece of ordered) {
    if (piece.from.getTime() > at) holes.push({ from: new Date(at), to: piece.from });

    at = Math.max(at, piece.to.getTime());
  }

  if (at < end) holes.push({ from: new Date(at), to: new Date(end) });

  return holes;
};

/**
 * Puts both ends of a reported stretch on the nearest increment boundary, and drops what is then left
 * with no time in it.
 *
 * Both ends round to the nearest, where a row's start floors and its end never falls short of the time
 * it books. A row books time and must never be drawn narrower than its own worklog; a stretch books
 * nothing, so the boundary nearest each raw end is the honest answer. The two rules can land up to an
 * increment apart, which is what {@link meetLaneRows} closes afterwards.
 */
const snapStretches = (stretches: readonly BehindStretch[], options?: Partial<RoundOptions>): BehindStretch[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options };
  const nearest = (at: Date) => Math.round(at.getTime() / incrementMs) * incrementMs;

  return stretches
    .map((stretch) => ({ ...stretch, from: new Date(nearest(stretch.from)), to: new Date(nearest(stretch.to)) }))
    .filter((stretch) => stretch.to.getTime() > stretch.from.getTime());
};

/** A drawn row, as the lane it sits in and the bounds it was snapped to. A row with no lane is in none. */
export type LaneRow = { laneKey?: string; from: Date; to: Date };

/**
 * Puts each end of a reported stretch on the row beside it in its own lane, where the two are within
 * an increment of each other.
 *
 * A stretch and a row are drawn on one grid, and each reaches it by its own rule: the stretch by the
 * boundary nearest its raw end, a row by the whole increments it books. Where the two disagree the
 * lane holds a quarter-hour nothing on the screen accounts for, and on a running day that hole opens
 * and closes as the row beside it grows.
 *
 * The reach is one increment because that is the size of the disagreement. A wider gap is time the
 * lane really held nothing, and a band drawn across it would claim presence there was none of.
 */
export const meetLaneRows = (options: {
  behind: readonly BehindStretch[];
  rows: readonly LaneRow[];
  round?: Partial<RoundOptions>;
}): BehindStretch[] => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const nearestTo = (at: Date, edges: readonly number[]) =>
    edges
      .filter((edge) => Math.abs(edge - at.getTime()) <= incrementMs)
      .sort((a, b) => Math.abs(a - at.getTime()) - Math.abs(b - at.getTime()))[0] ?? at.getTime();

  return options.behind.map((stretch) => {
    const lane = options.rows.filter((row) => row.laneKey === stretch.laneKey);
    const from = nearestTo(
      stretch.from,
      lane.map((row) => row.to.getTime()),
    );
    const to = nearestTo(
      stretch.to,
      lane.map((row) => row.from.getTime()),
    );

    if (to <= from) return stretch;

    return { ...stretch, from: new Date(from), to: new Date(to) };
  });
};

/**
 * Consecutive stretches of one lane and one key as one, so an afternoon behind another checkout is one
 * band rather than one per block the builder happened to cut the presence into.
 */
export const joinTouching = (stretches: readonly BehindStretch[]): BehindStretch[] => {
  const ordered = [...stretches].sort(
    (a, b) =>
      a.laneKey.localeCompare(b.laneKey) || a.issueKey.localeCompare(b.issueKey) || a.from.getTime() - b.from.getTime(),
  );
  const joined: BehindStretch[] = [];

  for (const stretch of ordered) {
    const last = joined[joined.length - 1];
    const continues =
      last &&
      last.laneKey === stretch.laneKey &&
      last.issueKey === stretch.issueKey &&
      last.to.getTime() >= stretch.from.getTime();

    if (!continues || !last) {
      joined.push(stretch);
      continue;
    }

    if (stretch.to > last.to) joined[joined.length - 1] = { ...last, to: stretch.to };
  }

  return joined.sort((a, b) => a.from.getTime() - b.from.getTime());
};

/**
 * Takes the stretches a foreground band covers away from a background band.
 *
 * A person can be in one checkout all day while the work they are booking happens in another, and a
 * band that claims every minute of that presence overlaps every other band on the day. The user says
 * which projects those are; no rule can read it off a day, because the same repository is background
 * on one day and the whole of the work on the next.
 *
 * Only a background band ever loses time. Two foreground bands of two repositories that overlap are a
 * day that ran two things at once, which is what `concurrency` is for and not a defect to resolve. A
 * checkout and its linked worktrees are one attention, and `cutUnwatched` has already resolved them
 * before this runs. Two background bands
 * are ranked against each other by the focus their streams held, then by which started first, so the
 * cut always resolves and never asks the reviewer to.
 *
 * The increment a running day is read through is held back from every background band — see
 * `through`. Those minutes are neither kept nor reported: nothing claims them yet.
 *
 * What it loses to a foreground band is reported as `behind` rather than thrown away. The cut is
 * silent otherwise: the lane holds an hour of presence, no row covers it, and nothing on the day says
 * which band took it.
 */
export const cutBackground = (options: { blocks: readonly AttributedBlock[] } & CutOptions): CutResult => {
  const background = new Set((options.backgroundProjects ?? []).map((key) => key.trim().toUpperCase()).filter(Boolean));

  if (!background.size) return { blocks: [...options.blocks], behind: [] };

  const focusMs = options.focusMsByStream ?? {};
  const isBackground = (entry: AttributedBlock) => {
    const project = entry.issueKey ? projectKeyOf(entry.issueKey) : undefined;

    return !!project && background.has(project);
  };

  const foreground = options.blocks.filter((entry) => !isBackground(entry));
  const settled = settledThrough(options);
  const ranked = options.blocks
    .filter(isBackground)
    .flatMap((entry) => {
      const part = settledPart(entry, settled);

      return part ? [part] : [];
    })
    .map((entry) => ({ entry, focus: focusMs[streamKey(entry.block.context)] ?? 0 }))
    .sort((a, b) => b.focus - a.focus || a.entry.block.from.getTime() - b.entry.block.from.getTime());

  const covered = [...foreground.map(windowOf), ...(options.claimed ?? [])];
  const kept: AttributedBlock[] = [];
  const behind: BehindStretch[] = [];

  for (const { entry } of ranked) {
    const issueKey = entry.issueKey;
    const pieces = piecesOf(entry, covered);

    if (issueKey) {
      behind.push(
        ...holesOf({ block: entry.block, kept: pieces.map((piece) => piece.block) }).map((hole) => ({
          ...hole,
          issueKey,
          laneKey: streamKey(entry.block.context),
        })),
      );
    }

    kept.push(...pieces);
    covered.push(...pieces.map(windowOf));
  }

  return {
    blocks: [...foreground, ...kept].sort((a, b) => a.block.from.getTime() - b.block.from.getTime()),
    behind: snapStretches(joinTouching(behind), options.round),
  };
};

/**
 * Takes an instant away from every session of a checkout but the one the user was watching.
 *
 * Two agent sessions of one checkout can run at the same time, and they are two pieces of work, so
 * the day holds two bands over the same minutes. Booking both claims an hour of the day twice. The
 * minutes go to the session the user prompted last, because a prompt is the only direct evidence of
 * attention a day holds — `plans/timetrack/one-session-one-piece.md` decides it.
 *
 * A checkout and its linked worktrees are one attention — ADR 0034. Where two of them hold the same
 * instant, the one the focused window was on keeps it, else the one holding the session the user
 * prompted last. What the others lose is reported as `behind`, the way `cutBackground` reports it.
 * Two checkouts that are not worktrees of each other are two things at once and keep their minutes.
 *
 * Only an instant two sessions really held is cut. A session running alone keeps its minutes whatever
 * the last prompt named: nothing else claims them, so nothing would be booked twice.
 *
 * Where the user prompted none of the sessions running, the oldest of them keeps the minutes. That is
 * the answer `sessionAt` gives the rest of the checkout, and it resolves rather than asking the
 * reviewer to.
 *
 * What the checkout ran is untouched. `engagedMs` in `streamDay` keeps counting both sessions: that
 * number says what ran, and this one says what is booked.
 */
export const cutUnwatched = (options: {
  blocks: readonly AttributedBlock[];
  events: readonly CollectedEvent[];
  /** Each linked worktree mapped to its main checkout, as `linkedWorktreesOf` builds it. */
  worktrees?: Readonly<Record<string, string>>;
  focusByStream?: CutOptions['focusByStream'];
  round?: Partial<RoundOptions>;
}): CutResult => {
  const prompts = watchPrompts(options.events);
  const worktrees = options.worktrees ?? {};
  const attentionOf = (entry: AttributedBlock) => {
    const main = worktrees[entry.block.context.repoPath ?? ''];

    return main ? streamKey({ repoPath: main }) : streamKey(entry.block.context);
  };
  const unitOf = (entry: AttributedBlock) =>
    `${streamKey(entry.block.context)}\u0000${entry.block.context.session ?? ''}`;
  const byAttention = new Map<string, AttributedBlock[]>();

  for (const entry of options.blocks) {
    if (!entry.block.context.session && !entry.block.context.repoPath) continue;

    const key = attentionOf(entry);
    const found = byAttention.get(key);

    if (found) found.push(entry);
    else byAttention.set(key, [entry]);
  }

  const unwatched = new Map<string, TimeWindow[]>();
  const lost = new Map<string, TimeWindow[]>();
  const push = (into: Map<string, TimeWindow[]>, cut: { unit: string; window: TimeWindow }) => {
    const found = into.get(cut.unit);

    if (found) found.push(cut.window);
    else into.set(cut.unit, [cut.window]);
  };

  for (const entries of byAttention.values()) {
    const streams = new Set(entries.map((entry) => streamKey(entry.block.context)));
    const candidates = streams.size > 1 ? entries : entries.filter((entry) => entry.block.context.session);
    const units = new Map<string, { stream: string; session?: string; startedAt: number }>();

    for (const entry of candidates) {
      const unit = unitOf(entry);
      const from = entry.block.from.getTime();
      const found = units.get(unit);

      units.set(unit, {
        stream: streamKey(entry.block.context),
        session: entry.block.context.session,
        startedAt: Math.min(found?.startedAt ?? from, from),
      });
    }

    if (units.size < 2) continue;

    const sessions = new Set([...units.values()].flatMap((unit) => (unit.session ? [unit.session] : [])));
    const focus = new Map([...streams].map((stream) => [stream, options.focusByStream?.[stream] ?? []]));
    // A prompt and a focus switch are edges as much as a block boundary is: attention moves in the
    // middle of a stretch two units held, and an interval that spans the move has two answers.
    const edges = [
      ...new Set([
        ...candidates.flatMap((entry) => [entry.block.from.getTime(), entry.block.to.getTime()]),
        ...prompts.filter((prompt) => sessions.has(prompt.sessionId)).map((prompt) => prompt.at.getTime()),
        ...(streams.size > 1
          ? [...focus.values()].flatMap((windows) => windows.flatMap((w) => [w.from.getTime(), w.to.getTime()]))
          : []),
      ]),
    ].sort((left, right) => left - right);
    const olderFirst = (left: string, right: string) =>
      (units.get(left)?.startedAt ?? 0) - (units.get(right)?.startedAt ?? 0) || left.localeCompare(right);

    for (let index = 0; index < edges.length - 1; index++) {
      const from = edges[index] ?? 0;
      const to = edges[index + 1] ?? 0;
      const window = { from: new Date(from), to: new Date(to) };
      const covering = new Set(
        candidates.filter((entry) => entry.block.from.getTime() <= from && entry.block.to.getTime() >= to).map(unitOf),
      );

      if (covering.size < 2) continue;

      const held = new Set([...covering].map((unit) => units.get(unit)?.stream ?? ''));
      let watchedStream = [...held][0] ?? '';

      if (held.size > 1) {
        const focused = [...held].find((stream) =>
          (focus.get(stream) ?? []).some((w) => w.from.getTime() <= from && w.to.getTime() >= to),
        );
        const coveringSessions = new Set(
          [...covering].flatMap((unit) => {
            const session = units.get(unit)?.session;

            return session ? [session] : [];
          }),
        );
        const prompted = watchedAt({ prompts, among: coveringSessions, at: window.from });
        const promptedUnit = [...covering].find((unit) => prompted && units.get(unit)?.session === prompted);
        const oldest = [...covering].sort(olderFirst)[0] ?? '';

        watchedStream = focused ?? units.get(promptedUnit ?? oldest)?.stream ?? '';

        for (const unit of covering) {
          if (units.get(unit)?.stream === watchedStream) continue;

          push(unwatched, { unit, window });
          push(lost, { unit, window });
        }
      }

      const running = [...covering].filter((unit) => {
        const found = units.get(unit);

        return found?.stream === watchedStream && !!found.session;
      });

      if (running.length < 2) continue;

      const among = new Set(running.map((unit) => units.get(unit)?.session ?? ''));
      const watchedSession = watchedAt({ prompts, among, at: window.from });
      const watched =
        running.find((unit) => units.get(unit)?.session === watchedSession) ?? [...running].sort(olderFirst)[0];

      for (const unit of running) if (unit !== watched) push(unwatched, { unit, window });
    }
  }

  if (!unwatched.size) return { blocks: [...options.blocks], behind: [] };

  const behind: BehindStretch[] = [];
  const blocks = options.blocks.flatMap((entry) => {
    const unit = unitOf(entry);
    const windows = unwatched.get(unit);

    if (!windows?.length) return [entry];

    const losses = lost.get(unit);
    const issueKey = entry.issueKey;

    if (losses?.length && issueKey) {
      behind.push(
        ...holesOf({ block: entry.block, kept: piecesOf(entry, losses).map((piece) => piece.block) }).map((hole) => ({
          ...hole,
          issueKey,
          laneKey: streamKey(entry.block.context),
        })),
      );
    }

    return piecesOf(entry, windows);
  });

  return {
    blocks: blocks.sort((left, right) => left.block.from.getTime() - right.block.from.getTime()),
    behind: snapStretches(joinTouching(behind), options.round),
  };
};
