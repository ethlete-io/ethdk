import { ActivityBlock } from '../model/block';
import { Evidence } from '../model/evidence';
import { ClosedTimerRun, timerRunDurationMs } from '../model/timer';
import { WorkGroup } from './merge';
import { overlapMs } from './overlap';

export type TimerMatch = {
  run: ClosedTimerRun;
  /**
   * Activity the collectors saw while the run was going. A run with almost none of it is a timer
   * somebody forgot to stop, which is the one way an explicit timer invents time.
   */
  observedMs: number;
  /** The reviewable row. Carries no `issueKey` until the user names one, which leaves it unattributed. */
  group: WorkGroup;
};

const pad = (value: number) => String(value).padStart(2, '0');

const timeOfDay = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const timerEvidence = (run: ClosedTimerRun): Evidence => ({
  kind: 'timer',
  at: run.from,
  detail: `timer you ran ${timeOfDay(run.from)}-${timeOfDay(run.to)}`,
  ...(run.note ? { summary: run.note } : {}),
});

/**
 * Turns timer runs into reviewable rows.
 *
 * A run is the only evidence in the system the user produced on purpose, so its span is `certain` and
 * its duration is its own, never the time the collectors happened to see inside it — the machine sees
 * nothing at all during an hour at a whiteboard, and that hour is exactly what a timer is for.
 *
 * Rows come back in start order. Pass the runs already closed; an open one has no duration to propose.
 */
export const matchTimerRuns = (options: {
  runs: readonly ClosedTimerRun[];
  blocks: readonly ActivityBlock[];
}): TimerMatch[] =>
  [...options.runs]
    .sort((a, b) => a.from.getTime() - b.from.getTime())
    .map((run) => {
      const window = { from: run.from, to: run.to };

      return {
        run,
        observedMs: options.blocks.reduce((sum, block) => sum + overlapMs({ block, window }), 0),
        group: {
          ...(run.issueKey ? { issueKey: run.issueKey } : {}),
          from: run.from,
          to: run.to,
          observedMs: timerRunDurationMs(run),
          confidence: 'certain' as const,
          evidence: [timerEvidence(run)],
          blocks: [],
        },
      };
    });
