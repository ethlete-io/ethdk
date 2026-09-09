import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { StreamDay, localDayKey, localDayRange, readHeadBranches$, shiftDayKey, streamDay } from '@ethlete/timetrack';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import {
  injectAgentPromptBackfill,
  injectAgentSessionCollector,
  injectAgentSpendBackfill,
  injectCodexPromptBackfill,
  injectCodexSessionCollector,
  injectCodexSpendBackfill,
  injectGitCollector,
  injectWindowCollector,
} from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { readViewState, rememberViewState } from '../view-state';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What this app's own windows report themselves as: the bundle identifier on macOS, and on Linux the
 * GTK application id, which is the binary name rather than the identifier.
 */
const OWN_APP_IDS = ['io.ethlete.timetrack', 'timetrack'];

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
  const codexSessions = injectCodexSessionCollector();
  const spend = injectAgentSpendBackfill();
  const codexSpend = injectCodexSpendBackfill();
  const prompts = injectAgentPromptBackfill();
  const codexPrompts = injectCodexPromptBackfill();
  const git = injectGitCollector();
  const settings = injectTimetrackSettings();

  const key = signal(readViewState().day ?? localDayKey(new Date()));

  const goToDay = (day: string) => {
    key.set(day);
    rememberViewState({ day });
  };

  const probe = computed(() => ({
    key: key(),
    repoRoots: git.discovery()?.repos ?? [],
    links: settings.settings().projectLinks,
    windows: windows.lastRun(),
    sessions: agentSessions.lastRun(),
    codexSessions: codexSessions.lastRun(),
    spend: spend.lastRun(),
    codexSpend: codexSpend.lastRun(),
    prompts: prompts.lastRun(),
    codexPrompts: codexPrompts.lastRun(),
    git: git.lastRun(),
  }));

  const loaded = toSignal(
    toObservable(probe).pipe(
      switchMap((current) => {
        const { from, to } = localDayRange(current.key);

        return ports.events.eventsBetween$(from, to).pipe(
          map((events): Loaded => ({
            key: current.key,
            value: streamDay({
              events,
              options: {
                repoRoots: [...current.repoRoots],
                links: current.links,
                ownAppIds: OWN_APP_IDS,
                windowsSeenThroughMs: current.windows?.at.getTime(),
              },
            }),
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

  /** The checkouts the day named no branch for: no commit, no branch switch and no agent session. */
  const unnamed = computed(() => {
    const read = current();

    if (!read?.value) return null;

    return {
      at: localDayRange(read.key).to,
      repoPaths: read.value.streams
        .filter((stream) => !!stream.repoPath && !stream.branches.length)
        .map((stream) => stream.repoPath as string),
    };
  });

  /**
   * The branch each of those checkouts was on that day, from its reflog. It resolves after the day
   * does, so a slow repository delays the branch on one line and never the day's numbers.
   */
  const headBranches = toSignal(
    toObservable(unnamed).pipe(
      switchMap((ask) =>
        ask?.repoPaths.length
          ? readHeadBranches$({ processes: ports.processes, ...ask }).pipe(catchError(() => of({})))
          : of<Record<string, string>>({}),
      ),
    ),
    { initialValue: {} as Record<string, string> },
  );

  return {
    dayKey: key.asReadonly(),
    day: computed(() => current()?.value ?? null),
    headBranches,
    isLoading: computed(() => !current()),
    failure: computed(() => current()?.failure ?? null),
    isToday: computed(() => key() === localDayKey(new Date())),

    shiftDay: (byDays: number) => goToDay(shiftDayKey(key(), byDays)),
    goToToday: () => goToDay(localDayKey(new Date())),
  };
});

export const provideToday = /* @__PURE__ */ toProvideFn(TODAY_DEF);
export const injectToday = /* @__PURE__ */ toInjectFn(TODAY_DEF);
