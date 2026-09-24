import { mergeEvidence } from '../rows/merge';
import { storedLaneKey } from '../rows/lane';
import { Evidence } from '../model/evidence';
import { TimeWindow } from '../model/time-window';

type FoldRow = TimeWindow & {
  id: string;
  issueKey?: string;
  standInId?: string;
  laneKey?: string;
  durationMs: number;
  observedMs: number;
  evidence: Evidence[];
  stretches?: TimeWindow[];
  excluded?: boolean;
  unattended?: boolean;
  folded?: string[];
};

type FoldBlocker = TimeWindow & { laneKey?: string; issueKey?: string };

const nameOf = (row: FoldRow) =>
  row.issueKey ? `issue:${row.issueKey}` : row.standInId ? `stand-in:${row.standInId}` : undefined;

const spanOf = (row: TimeWindow) => row.to.getTime() - row.from.getTime();

const gapMs = (a: TimeWindow, b: TimeWindow) =>
  Math.max(0, Math.max(a.from.getTime(), b.from.getTime()) - Math.min(a.to.getTime(), b.to.getTime()));

const overlaps = (a: TimeWindow, b: TimeWindow) =>
  a.from.getTime() < b.to.getTime() && b.from.getTime() < a.to.getTime();

/**
 * Folds every row that books a single increment into the nearest row of the same name in its lane,
 * which grows toward it by that increment. The day's total stays the same; where the time sits moves.
 *
 * A row longer than one increment is preferred as the neighbour. A short row with no such neighbour
 * folds into another short row of its name, and one with no neighbour at all, or whose neighbour
 * would grow over another row of the lane or one it `collides` with, stays as it is. `fixed` rows neither fold nor absorb, and
 * `blockers` only stop a growth. The grown row keeps its id and lists what it took in on `folded`.
 */
export const foldShortRows = <T extends FoldRow>(options: {
  rows: readonly T[];
  incrementMs: number;
  fixed: (row: T) => boolean;
  canFold: (row: T) => boolean;
  blockers: readonly FoldBlocker[];
  /** Whether a row in another lane still claims the same minutes as the row growing over them. */
  collides?: (grower: T, other: FoldBlocker) => boolean;
}): T[] => {
  const rows = [...options.rows].sort((a, b) => a.from.getTime() - b.from.getTime());
  const gone = new Set<T>();
  const takesPart = (row: T) => !options.fixed(row) && !row.excluded && !row.unattended && !!nameOf(row);
  const isShort = (row: T) => spanOf(row) === options.incrementMs;

  for (let index = 0; index < rows.length; index++) {
    const short = rows[index];

    if (!short || !isShort(short) || !takesPart(short) || !options.canFold(short) || gone.has(short)) continue;

    const lane = storedLaneKey(short.laneKey);
    const candidates = rows
      .filter(
        (row) =>
          row !== short &&
          !gone.has(row) &&
          takesPart(row) &&
          nameOf(row) === nameOf(short) &&
          storedLaneKey(row.laneKey) === lane,
      )
      .sort((a, b) => Number(isShort(a)) - Number(isShort(b)) || gapMs(a, short) - gapMs(b, short));
    const [neighbour] = candidates;

    if (!neighbour || !lane) continue;

    const after = short.from.getTime() >= neighbour.to.getTime();
    const growth: TimeWindow = after
      ? { from: neighbour.to, to: new Date(neighbour.to.getTime() + spanOf(short)) }
      : { from: new Date(neighbour.from.getTime() - spanOf(short)), to: neighbour.from };
    const others = [...rows.filter((row) => row !== short && row !== neighbour && !gone.has(row)), ...options.blockers];

    const blocks = (other: FoldBlocker) =>
      storedLaneKey(other.laneKey) === lane || (options.collides?.(neighbour, other) ?? false);

    if (others.some((other) => overlaps(other, growth) && blocks(other))) continue;

    const grown: T = {
      ...neighbour,
      from: after ? neighbour.from : growth.from,
      to: after ? growth.to : neighbour.to,
      durationMs: spanOf(neighbour) + spanOf(short),
      observedMs: neighbour.observedMs + short.observedMs,
      evidence: mergeEvidence([neighbour.evidence, short.evidence]),
      folded: [...(neighbour.folded ?? []), short.id, ...(short.folded ?? [])],
      ...(neighbour.stretches || short.stretches
        ? {
            stretches: [...(neighbour.stretches ?? []), ...(short.stretches ?? [])].sort(
              (a, b) => a.from.getTime() - b.from.getTime(),
            ),
          }
        : {}),
    };

    rows[rows.indexOf(neighbour)] = grown;
    gone.add(short);
  }

  return rows.filter((row) => !gone.has(row));
};
