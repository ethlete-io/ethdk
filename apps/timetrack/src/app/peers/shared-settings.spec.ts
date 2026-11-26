import {
  AttributionRule,
  DEFAULT_TIMETRACK_SETTINGS,
  PeerSharedSettings,
  SharedSettingsEntry,
  StandIn,
  TimetrackSettings,
  stampSharedSettings,
} from '@ethlete/timetrack';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiveSharedSettings$, sendSharedSettings$ } from './shared-settings';

const STAND_IN: StandIn = {
  id: 'stand-in:1:fifa',
  name: 'Standings rework',
  state: 'open',
  days: [],
  author: 'user',
  createdAt: new Date('2026-11-17T09:00:00Z'),
};

const withStandIns = (standIns: StandIn[]): TimetrackSettings => ({ ...DEFAULT_TIMETRACK_SETTINGS, standIns });

describe('sendSharedSettings$', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the rules and stand-ins once a change settles, and an unchanged set only once', () => {
    const settings$ = new Subject<TimetrackSettings>();
    const sent: (readonly SharedSettingsEntry[])[] = [];
    const subscription = sendSharedSettings$({
      settings$,
      ownKeys$: () => of({}),
      send$: (entries) => {
        sent.push(entries);

        return of(undefined);
      },
      debounceMs: 100,
    }).subscribe();

    settings$.next(withStandIns([]));
    settings$.next(withStandIns([STAND_IN]));
    vi.advanceTimersByTime(100);

    expect(sent.map((entries) => entries.map((entry) => entry.id))).toEqual([['stand-in:stand-in:1:fifa']]);

    settings$.next({ ...withStandIns([STAND_IN]), dayTargetMs: 1 });
    vi.advanceTimersByTime(100);

    expect(sent).toHaveLength(1);
    subscription.unsubscribe();
  });

  it('sends the rule of a removed worktree that the events still carry', () => {
    const removed = '/home/human/dev/fifa-wt-gone';
    const removedRule: AttributionRule = {
      id: `repo:${removed}@feat/gone#3`,
      repoPath: removed,
      branch: 'feat/gone',
      target: { kind: 'stand-in', standInId: STAND_IN.id },
      author: 'app',
      createdAt: STAND_IN.createdAt,
    };
    const settings = stampSharedSettings({
      before: DEFAULT_TIMETRACK_SETTINGS,
      after: { ...DEFAULT_TIMETRACK_SETTINGS, attributionRules: [removedRule] },
      atMs: 1_000,
    });
    const run = (carried: string[]) => {
      const sent: (readonly SharedSettingsEntry[])[] = [];
      const subscription = sendSharedSettings$({
        settings$: of(settings),
        ownKeys$: () => of({}),
        carriedPaths$: () => of(carried),
        send$: (entries) => {
          sent.push(entries);

          return of(undefined);
        },
        debounceMs: 100,
      }).subscribe();

      vi.advanceTimersByTime(100);
      subscription.unsubscribe();

      return sent.flat().map((entry) => entry.id);
    };

    const calls: (readonly string[])[] = [];
    const keyedRun = () => {
      const subscription = sendSharedSettings$({
        settings$: of(settings),
        ownKeys$: () => of({ [removed]: removed }),
        carriedPaths$: (ids) => {
          calls.push(ids);

          return of([]);
        },
        send$: () => of(undefined),
        debounceMs: 100,
      }).subscribe();

      vi.advanceTimersByTime(100);
      subscription.unsubscribe();
    };

    keyedRun();
    expect(calls).toEqual([]);
    expect(run([])).toEqual([]);
    expect(run([removed])).toEqual([`rule:${removedRule.id}`]);
  });

  it('keeps sending after the host failed once', () => {
    const settings$ = new Subject<TimetrackSettings>();
    let calls = 0;
    const subscription = sendSharedSettings$({
      settings$,
      ownKeys$: () => of({}),
      send$: () => {
        calls += 1;

        return calls === 1 ? throwError(() => new Error('host down')) : of(undefined);
      },
      debounceMs: 100,
    }).subscribe();

    settings$.next(withStandIns([STAND_IN]));
    vi.advanceTimersByTime(100);
    settings$.next(withStandIns([]));
    vi.advanceTimersByTime(100);

    expect(calls).toBe(2);
    subscription.unsubscribe();
  });
});

describe('receiveSharedSettings$', () => {
  it('hands what the paired machines sent to the merge, and skips a tick without any', () => {
    const tick$ = new Subject<void>();
    const merged: (readonly PeerSharedSettings[])[] = [];
    const peers: PeerSharedSettings[] = [{ entries: [], clockOffsetMs: 0 }];
    let answer: PeerSharedSettings[] = [];
    const subscription = receiveSharedSettings$({
      tick$,
      received$: () => of({ ownRepoKeys: {}, peers: answer }),
      merge: (received) => merged.push(received),
    }).subscribe();

    tick$.next();
    answer = peers;
    tick$.next();

    expect(merged).toEqual([peers]);
    subscription.unsubscribe();
  });
});
