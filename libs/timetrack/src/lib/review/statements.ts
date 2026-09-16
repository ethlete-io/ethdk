import { PresenceStatement, statementWindows } from '../model/statement';
import { TimeWindow, mergeWindows, subtractWindows } from '../model/time-window';
import { DEFAULT_ROUND_OPTIONS, RoundOptions } from '../rows/round';
import { DayReviewEdits } from './model';

const statementIdFor = (options: { kind: PresenceStatement['kind']; from: Date; taken: Set<string> }) => {
  const base = `${options.kind}@${options.from.toISOString()}`;
  let id = base;
  let suffix = 2;

  while (options.taken.has(id)) id = `${base}#${suffix++}`;

  options.taken.add(id);

  return id;
};

/**
 * The stretch a statement covers, on the grid the rows sit on, and never shorter than one increment.
 *
 * Both ends round to the nearest boundary, so a statement lines up with the bands around it and the
 * break it changes lines up with both.
 */
const snappedWindow = (options: { from: Date; to: Date; incrementMs: number }): TimeWindow => {
  const nearest = (ms: number) => Math.round(ms / options.incrementMs) * options.incrementMs;
  const from = nearest(options.from.getTime());

  return { from: new Date(from), to: new Date(Math.max(nearest(options.to.getTime()), from + options.incrementMs)) };
};

/**
 * Writes what the user says a stretch of the day was. `present` clips every break out of it; `away`
 * draws one over it.
 *
 * The new statement is taken out of every statement of the other kind it covers, so the day never
 * holds two statements that contradict each other and the newest answer is the one that stands. A
 * statement the new one covers whole is gone; one it cuts in half leaves two.
 */
export const writeStatement = (options: {
  edits: DayReviewEdits;
  kind: PresenceStatement['kind'];
  from: Date;
  to: Date;
  /** The increment the rows were snapped to. Both ends of the statement land on it. */
  round?: Partial<RoundOptions>;
}): DayReviewEdits => {
  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };
  const window = snappedWindow({ from: options.from, to: options.to, incrementMs });
  const taken = new Set(options.edits.statements.map((statement) => statement.id));

  const kept = options.edits.statements.flatMap((statement) =>
    statement.kind === options.kind
      ? [statement]
      : subtractWindows({ windows: [statement], without: [window] }).map((part, index) => ({
          ...statement,
          ...part,
          id: index ? statementIdFor({ kind: statement.kind, from: part.from, taken }) : statement.id,
        })),
  );

  return {
    ...options.edits,
    statements: [
      ...kept,
      { ...window, id: statementIdFor({ kind: options.kind, from: window.from, taken }), kind: options.kind },
    ],
  };
};

/** Takes back one statement, which puts the stretch it covered back to what the day measured. */
export const deleteStatement = (options: { edits: DayReviewEdits; id: string }): DayReviewEdits => ({
  ...options.edits,
  statements: options.edits.statements.filter((statement) => statement.id !== options.id),
});

/** Takes back every statement of the day, leaving the rows and their edits alone. */
export const clearStatements = (options: { edits: DayReviewEdits }): DayReviewEdits => ({
  ...options.edits,
  statements: [],
});

/**
 * The day's presence as the user's statements leave it: a `present` statement is unioned in, an
 * `away` statement is taken out.
 *
 * The two kinds never overlap, so the order they are applied in cannot decide the answer.
 */
export const statedPresence = (options: {
  presence: readonly TimeWindow[];
  statements: readonly PresenceStatement[];
}): TimeWindow[] =>
  subtractWindows({
    windows: mergeWindows([...options.presence, ...statementWindows(options.statements, 'present')]),
    without: statementWindows(options.statements, 'away'),
  });
