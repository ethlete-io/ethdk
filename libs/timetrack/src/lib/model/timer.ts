/**
 * A stretch of time the user asserted by starting and stopping a timer, as opposed to one
 * reconstructed from evidence. At most one run is open at a time.
 */
export type TimerRun = {
  id: string;
  from: Date;
  /** Absent while the run is still going. */
  to?: Date;
  /** What the user says the time is for. Absent until they name it, which they may do while it runs. */
  issueKey?: string;
  /** The user's own wording for the worklog description. */
  note?: string;
};

/** A run whose end is decided — an open one closed at some instant, so a day can be reconstructed. */
export type ClosedTimerRun = TimerRun & { to: Date };

export const isTimerRunning = (run: TimerRun) => run.to === undefined;

/**
 * Decides an open run's end so the pipeline can treat it like any other span.
 *
 * `at` is clamped to the start rather than trusted: a clock that stepped backwards, or a run restored
 * from a database written before a suspend, would otherwise produce a negative duration that every
 * later sum silently absorbs.
 */
export const closeTimerRun = (run: TimerRun, at: Date): ClosedTimerRun => ({
  ...run,
  to: run.to ?? (at > run.from ? at : run.from),
});

export const timerRunDurationMs = (run: ClosedTimerRun) => run.to.getTime() - run.from.getTime();
