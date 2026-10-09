import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { JIRA_MIRROR_SYNC_MS, JiraMirror, readJiraCredentials$, syncJiraMirror$ } from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectProjectLinks } from '../project-links';
import { injectTimetrackSettings } from '../settings/settings';
import { injectWindowLock } from '../window-lock';

/**
 * The local mirror of each linked Jira project's issues, read whole once a day and for what changed
 * every {@link JIRA_MIRROR_SYNC_MS} while auto mode is on. A failed read keeps the mirror held.
 */
const JIRA_MIRROR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const projectLinks = injectProjectLinks();
  const windowLock = injectWindowLock();
  const mirrors = signal<ReadonlyMap<string, JiraMirror>>(new Map());
  const running = new Map<string, Observable<JiraMirror | null>>();

  const loaded$ = ports.jiraMirrors.read$().pipe(
    tap((stored) =>
      mirrors.update((held) => new Map([...stored.map((mirror) => [mirror.projectKey, mirror] as const), ...held])),
    ),
    map(() => undefined),
    catchError(() => of(undefined)),
    shareReplay(1),
  );

  const keep = (mirror: JiraMirror) => mirrors.update((held) => new Map([...held, [mirror.projectKey, mirror]]));

  const sync$ = (projectKey: string): Observable<JiraMirror | null> => {
    const key = projectKey.trim().toUpperCase();
    const held = running.get(key);

    if (held) return held;

    const run$ = loaded$.pipe(
      switchMap(() => readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() })),
      switchMap((credentials) =>
        credentials
          ? syncJiraMirror$({
              transport: ports.transport,
              credentials,
              projectKey: key,
              held: mirrors().get(key) ?? null,
              nowMs: Date.now(),
              subjectField: settings.settings().ticket.subjectField || undefined,
            }).pipe(
              tap(keep),
              switchMap((mirror) =>
                ports.jiraMirrors.save$(mirror).pipe(
                  catchError(() => of(undefined)),
                  map(() => mirror),
                ),
              ),
            )
          : of(null),
      ),
      catchError(() => of(mirrors().get(key) ?? null)),
      finalize(() => running.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    running.set(key, run$);

    return run$;
  };

  const linkedProjectKeys = computed(() =>
    [
      ...new Set(
        projectLinks().flatMap((link) =>
          link.target.kind === 'project' ? [link.target.projectKey.trim().toUpperCase()] : [],
        ),
      ),
    ]
      .sort()
      .join(','),
  );

  const active = computed(() => {
    const { reasoning } = settings.settings();

    return reasoning.enabled && reasoning.autoMode && !windowLock.isLocked();
  });

  const due = (projectKey: string) => {
    const held = mirrors().get(projectKey);

    return !held || Date.now() - held.syncedAtMs >= JIRA_MIRROR_SYNC_MS / 2 || Date.now() < held.syncedAtMs;
  };

  toObservable(computed(() => (active() ? linkedProjectKeys() : '')))
    .pipe(
      distinctUntilChanged(),
      switchMap((keys) =>
        keys
          ? timer(0, JIRA_MIRROR_SYNC_MS).pipe(
              exhaustMap(() =>
                loaded$.pipe(
                  switchMap(() => from(keys.split(',').filter(due))),
                  concatMap((projectKey) => sync$(projectKey)),
                ),
              ),
            )
          : EMPTY,
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    /** The issues of the mirror held for a project, `undefined` while none is. Reactive. */
    issuesOf: (projectKey: string) => mirrors().get(projectKey.trim().toUpperCase())?.issues,
    /** The mirror of one project, read first where none is held yet. `null` when Jira cannot be read. */
    mirror$: (projectKey: string): Observable<JiraMirror | null> =>
      loaded$.pipe(
        switchMap(() => {
          const held = mirrors().get(projectKey.trim().toUpperCase());

          return held ? of(held) : sync$(projectKey);
        }),
      ),
  };
});

export const injectJiraMirror = /* @__PURE__ */ toInjectFn(JIRA_MIRROR_DEF);
