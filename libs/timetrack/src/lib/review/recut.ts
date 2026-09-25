import { BehindStretch, LaneRow, joinTouching, meetLaneRows } from '../rows/cut';
import { RoundOptions } from '../rows/round';
import { DEFAULT_MIN_BREAK_MS } from '../stream/breaks';
import { projectKeyOf } from '../ticket/project';
import { ReviewedRow } from './model';

type Span = { from: number; to: number };

/**
 * The stretches of a background row that no foreground row covers, in order.
 *
 * A foreground row inside the background row leaves two of them, which is why this is a list: a row
 * left whole across a meeting books the meeting's minutes a second time.
 */
const keptSpansOf = (options: { row: ReviewedRow; covered: readonly LaneRow[] }): Span[] => {
  const start = options.row.from.getTime();
  const end = options.row.to.getTime();
  const windows = options.covered
    .map((other) => ({ from: Math.max(start, other.from.getTime()), to: Math.min(end, other.to.getTime()) }))
    .filter((window) => window.to > window.from)
    .sort((left, right) => left.from - right.from);

  const kept: Span[] = [];
  let at = start;

  for (const window of windows) {
    if (window.from > at) kept.push({ from: at, to: window.from });

    at = Math.max(at, window.to);
  }

  if (at < end) kept.push({ from: at, to: end });

  return kept;
};

/** The stretches the kept spans no longer cover — what the row gave up, and what a band reports. */
const lostSpansOf = (options: { row: ReviewedRow; kept: readonly Span[] }): Span[] => {
  const end = options.row.to.getTime();
  const lost: Span[] = [];

  let at = options.row.from.getTime();

  for (const span of options.kept) {
    if (span.from > at) lost.push({ from: at, to: span.from });

    at = span.to;
  }

  if (at < end) lost.push({ from: at, to: end });

  return lost;
};

/**
 * One kept stretch of a background row, as a row.
 *
 * `observedMs` is scaled by the part of the row the piece kept. The minutes it gave up were observed
 * under the row that took them, and a piece reporting the whole row's observed time would have the
 * day claim them twice over.
 *
 * Only a second and later piece is given an id of its own, so an edit already written against the
 * row still reaches the piece that starts where the row did. `recutOf` is what carries the rest of
 * them back to the row they were cut out of — see {@link ReviewedRow.recutOf}.
 */
const pieceOf = (options: { row: ReviewedRow; span: Span; at: number }): ReviewedRow => {
  const { row, span, at } = options;
  const spanMs = row.to.getTime() - row.from.getTime();
  const keptMs = span.to - span.from;

  if (keptMs === spanMs) return row;

  return {
    ...row,
    id: at === 0 ? row.id : `${row.id}#${at + 1}`,
    recutOf: row.recutOf ?? row.id,
    from: new Date(span.from),
    to: new Date(span.to),
    observedMs: spanMs > 0 ? Math.round((row.observedMs * keptMs) / spanMs) : 0,
  };
};

/**
 * Whether the day was told this band is not work, so it claims none of a background row's minutes.
 *
 * A row nobody has answered yet still claims them: the test is what the band is, never whether a sync
 * writes it. Naming an excluded call is the user overruling the rule, and from then on it claims like
 * any other row - the same reading as `colorTokenOf` on the day screen. See ADR 0024.
 */
const takesNothing = (row: ReviewedRow) => (!!row.excluded && !row.issueKey) || row.state === 'rejected';

/** Whether a row names an issue of one of the background projects, so the re-cut gives its minutes away. */
export const backgroundTest = (backgroundProjects: readonly string[] | undefined) => {
  const background = new Set((backgroundProjects ?? []).map((key) => key.trim().toUpperCase()).filter(Boolean));

  return (row: { issueKey?: string }) => {
    const project = row.issueKey ? projectKeyOf(row.issueKey) : undefined;

    return !!project && background.has(project);
  };
};

const lostMsOf = (stretch: BehindStretch) => stretch.durationMs ?? stretch.to.getTime() - stretch.from.getTime();

/** Whether no stretch of the gap longer than a break is left uncovered by a row that books time. */
const workedAcross = (options: { from: number; to: number; rows: readonly ReviewedRow[] }) => {
  const windows = options.rows
    .filter((row) => !takesNothing(row))
    .map((row) => ({ from: Math.max(options.from, row.from.getTime()), to: Math.min(options.to, row.to.getTime()) }))
    .filter((window) => window.to > window.from)
    .sort((left, right) => left.from - right.from);

  let at = options.from;

  for (const window of windows) {
    if (window.from - at > DEFAULT_MIN_BREAK_MS) return false;

    at = Math.max(at, window.to);
  }

  return options.to - at <= DEFAULT_MIN_BREAK_MS;
};

/**
 * One band per ticket and lane across worked time. A gap no row accounts for starts a new band, or a
 * band would claim the night. `durationMs` stays the sum of what the pieces lost.
 */
const joinOneTicket = (options: {
  stretches: readonly BehindStretch[];
  rows: readonly ReviewedRow[];
}): BehindStretch[] => {
  const open = new Map<string, BehindStretch>();
  const bands: BehindStretch[] = [];

  for (const stretch of joinTouching(options.stretches)) {
    const key = `${stretch.laneKey}\n${stretch.issueKey}`;
    const band = open.get(key);
    const joins = band && workedAcross({ from: band.to.getTime(), to: stretch.from.getTime(), rows: options.rows });

    if (band && !joins) bands.push(band);

    open.set(
      key,
      band && joins
        ? {
            ...band,
            to: stretch.to > band.to ? stretch.to : band.to,
            durationMs: lostMsOf(band) + lostMsOf(stretch),
          }
        : stretch,
    );
  }

  return [...bands, ...open.values()].sort((a, b) => a.from.getTime() - b.from.getTime());
};

/**
 * Cuts the day's background rows against the rows the reviewer ended up with, and reports what they
 * lost as bands drawn behind them.
 *
 * `cutBackground` runs on the machine's own blocks, before a reviewer has touched anything. Growing a
 * meeting over a background row afterwards leaves both claiming the same minutes, and the day books
 * them twice. Only a background row ever gives way, the same rule the first cut follows.
 *
 * A row it empties out is dropped: every minute it held went to the row that took them, and the band
 * left behind is what still says the work happened.
 */
export const recutReviewedRows = (options: {
  rows: readonly ReviewedRow[];
  behind: readonly BehindStretch[];
  backgroundProjects?: readonly string[];
  round?: Partial<RoundOptions>;
}): { rows: ReviewedRow[]; behind: BehindStretch[] } => {
  const isBackground = backgroundTest(options.backgroundProjects);

  if (!options.rows.some(isBackground)) {
    return { rows: [...options.rows], behind: joinOneTicket({ stretches: options.behind, rows: options.rows }) };
  }

  const covered = options.rows.filter((row) => !isBackground(row) && !takesNothing(row));
  const rows: ReviewedRow[] = [];
  const lost: BehindStretch[] = [];

  for (const row of options.rows) {
    if (!isBackground(row) || !row.issueKey) {
      rows.push(row);
      continue;
    }

    const kept = keptSpansOf({ row, covered });
    const laneKey = row.laneKey;

    if (laneKey) {
      for (const span of lostSpansOf({ row, kept })) {
        lost.push({ from: new Date(span.from), to: new Date(span.to), issueKey: row.issueKey, laneKey });
      }
    }

    rows.push(...kept.map((span, at) => pieceOf({ row, span, at })));
  }

  return {
    rows,
    behind: joinOneTicket({
      stretches: meetLaneRows({ behind: joinTouching([...options.behind, ...lost]), rows, round: options.round }),
      rows,
    }),
  };
};
