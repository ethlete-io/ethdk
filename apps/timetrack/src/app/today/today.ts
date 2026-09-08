import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { StreamDay, localDayKey, localDayRange, shiftDayKey, streamDay } from '@ethlete/timetrack';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import {
  injectAgentSessionCollector,
  injectAgentSpendBackfill,
  injectGitCollector,
  injectWindowCollector,
} from '../../collectors';
import { injectHostPorts } from '../../host';
import { readViewState, rememberViewState } from '../view-state';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A day tagged with the day it was asked for, so an answer for yesterday is not shown as today. */
type Loaded = { key: string; value: StreamDay | null; failure: string | null };

/**
 * The day as its streams: what was worked on, for how long, and what the agents spent on it.
 *
 * It reads the store and nothing else. No attribution, no rules, no reasoning provider and no write —
 * so where a line is wrong, exactly one thing can be wrong with it.
 */
const TODAY_DEF = /* @__PURE__ */ defineProvider(() => {
  const ports = injectHostPorts();
  const windows = injectWindowCollector();
  const agentSessions = injectAgentSessionCollector();
  const spend = injectAgentSpendBackfill();
  const git = injectGitCollector();

  const key = signal(readViewState().day ?? localDayKey(new Date()));

  const goToDay = (day: string) => {
    key.set(day);
    rememberViewState({ day });
  };

  const probe = computed(() => ({
    key: key(),
    repoRoots: git.discovery()?.repos ?? [],
    windows: windows.lastRun(),
    sessions: agentSessions.lastRun(),
    spend: spend.lastRun(),
    git: git.lastRun(),
  }));

  const loaded = toSignal(
    toObservable(probe).pipe(
      switchMap((current) => {
        const { from, to } = localDayRange(current.key);

        return ports.events.eventsBetween$(from, to).pipe(
          map((events): Loaded => ({
            key: current.key,
            value: streamDay({ events, options: { repoRoots: [...current.repoRoots] } }),
            failure: null,
          })),
          catchError((error: unknown) => of<Loaded>({ key: current.key, value: null, failure: messageOf(error) })),
        );
      }),
      startWith(null),
    ),
    { initialValue: null },
  );

  const current = computed(() => {
    const read = loaded();

    return read?.key === key() ? read : null;
  });

  return {
    dayKey: key.asReadonly(),
    day: computed(() => current()?.value ?? null),
    isLoading: computed(() => !current()),
    failure: computed(() => current()?.failure ?? null),
    isToday: computed(() => key() === localDayKey(new Date())),

    shiftDay: (byDays: number) => goToDay(shiftDayKey(key(), byDays)),
    goToToday: () => goToDay(localDayKey(new Date())),
  };
});

export const provideToday = /* @__PURE__ */ toProvideFn(TODAY_DEF);
export const injectToday = /* @__PURE__ */ toInjectFn(TODAY_DEF);
