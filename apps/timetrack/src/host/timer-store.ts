import { TimerRun, TimetrackTimerStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredRun = {
  id: string;
  startedAtMs: number;
  stoppedAtMs: number | null;
  issueKey: string | null;
  note: string | null;
};

const revive = (stored: StoredRun): TimerRun => ({
  id: stored.id,
  from: new Date(stored.startedAtMs),
  ...(stored.stoppedAtMs === null ? {} : { to: new Date(stored.stoppedAtMs) }),
  ...(stored.issueKey === null ? {} : { issueKey: stored.issueKey }),
  ...(stored.note === null ? {} : { note: stored.note }),
});

export const createTauriTimerStore = (): TimetrackTimerStore => ({
  runsBetween$: (from, to) =>
    invokeHost$<StoredRun[]>('timer_runs_between', { fromMs: from.getTime(), toMs: to.getTime() }).pipe(
      map((rows) => rows.map(revive)),
    ),
  running$: () =>
    invokeHost$<StoredRun | null>('timer_running').pipe(map((row) => (row === null ? null : revive(row)))),
  start$: (at) => invokeHost$<StoredRun>('timer_start', { atMs: at.getTime() }).pipe(map(revive)),
  stop$: (at) =>
    invokeHost$<StoredRun | null>('timer_stop', { atMs: at.getTime() }).pipe(
      map((row) => (row === null ? null : revive(row))),
    ),
  label$: (id, label) => invokeHost$<void>('timer_label', { id, issueKey: label.issueKey, note: label.note }),
});
