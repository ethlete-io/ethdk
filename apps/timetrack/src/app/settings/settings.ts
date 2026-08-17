import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AttributionRule,
  DEFAULT_TIMETRACK_SETTINGS,
  ProjectLinkTarget,
  TIMETRACK_SECRET_KEYS,
  TimetrackCredentialStatus,
  TimetrackExclusionRule,
  TimetrackGitLabSettings,
  TimetrackReasoningSettings,
  TimetrackGoogleSettings,
  TimetrackJiraSettings,
  TimetrackSettings,
  TimetrackTicketSettings,
  clampDayTargetMs,
  clampGapFillMs,
  clampLockAfterIdleMs,
  clampMinuteOfDay,
  timetrackCredentialStatus,
  withAttributionRule,
  withFavoriteProjects,
  withProjectLink,
  withoutAttributionRule,
  withoutFavoriteProject,
  withoutProjectLink,
} from '@ethlete/timetrack';
import {
  Subject,
  catchError,
  combineLatest,
  concatMap,
  debounceTime,
  filter,
  map,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { injectHostPorts } from '../../host';

/** How long an edit settles before the settings document is written. */
const SAVE_DEBOUNCE_MS = 400;

/**
 * The keychain accounts the screen asks about. The client secret is not a credential in its own right —
 * it is half of one — so it is held here rather than in the provider status.
 */
type HeldSecrets = TimetrackCredentialStatus & { googleClientSecret: boolean };

const NOTHING_HELD: HeldSecrets = {
  jira: false,
  tempo: false,
  google: false,
  gitlab: false,
  googleClientSecret: false,
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sameRule = (a: TimetrackExclusionRule, b: TimetrackExclusionRule) =>
  a.kind === 'app-id' && b.kind === 'app-id'
    ? a.appId.toLowerCase() === b.appId.toLowerCase()
    : a.kind === 'title-pattern' && b.kind === 'title-pattern' && a.pattern === b.pattern;

/**
 * What the user configured, and the only place the app writes it.
 *
 * Nothing here holds a token. A token is written straight to the keychain and only ever asked about —
 * `credentials` says which providers are configured, and there is no path back into the window for the
 * value itself.
 */
const SETTINGS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const destroyRef = inject(DestroyRef);

  const local = signal<TimetrackSettings | null>(null);
  const secretRevision = signal(0);
  const failure = signal<string | null>(null);
  const saves$ = new Subject<TimetrackSettings>();

  const loaded = toSignal(
    ports.settings.read$().pipe(
      map((stored) => stored ?? DEFAULT_TIMETRACK_SETTINGS),
      catchError((error: unknown) => {
        failure.set(messageOf(error));

        return of(DEFAULT_TIMETRACK_SETTINGS);
      }),
    ),
    { initialValue: null },
  );

  const settings = computed(() => local() ?? loaded() ?? DEFAULT_TIMETRACK_SETTINGS);
  const isLoading = computed(() => !loaded());

  const held = toSignal(
    toObservable(secretRevision).pipe(
      switchMap(() =>
        combineLatest({
          jira: ports.secrets.has$(TIMETRACK_SECRET_KEYS.jiraToken),
          tempo: ports.secrets.has$(TIMETRACK_SECRET_KEYS.tempoToken),
          google: ports.secrets.has$(TIMETRACK_SECRET_KEYS.googleRefreshToken),
          gitlab: ports.secrets.has$(TIMETRACK_SECRET_KEYS.gitlabToken),
          googleClientSecret: ports.secrets.has$(TIMETRACK_SECRET_KEYS.googleClientSecret),
        }).pipe(
          catchError((error: unknown) => {
            failure.set(messageOf(error));

            return of(NOTHING_HELD);
          }),
        ),
      ),
    ),
    { initialValue: NOTHING_HELD },
  );

  saves$
    .pipe(
      debounceTime(SAVE_DEBOUNCE_MS),
      concatMap((next) =>
        ports.settings.save$(next).pipe(
          catchError((error: unknown) => {
            failure.set(messageOf(error));

            return of(undefined);
          }),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const apply = (next: TimetrackSettings) => {
    local.set(next);
    saves$.next(next);
  };

  const patch = (change: Partial<TimetrackSettings>) => apply({ ...settings(), ...change });

  /** A `null` value removes the entry, which is how a provider is disconnected. */
  const secretWrites$ = new Subject<{ key: string; value: string | null }>();

  secretWrites$
    .pipe(
      concatMap(({ key, value }) =>
        (value === null ? ports.secrets.delete$(key) : ports.secrets.write$(key, value)).pipe(
          catchError((error: unknown) => {
            failure.set(messageOf(error));

            return of(undefined);
          }),
        ),
      ),
      tap(() => secretRevision.update((count) => count + 1)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return {
    settings,
    isLoading,
    failure: failure.asReadonly(),
    credentials: computed(() => timetrackCredentialStatus({ held: held(), settings: settings() })),
    hasGoogleClientSecret: computed(() => held().googleClientSecret),

    /**
     * Emits the settings once they have been read, so a collector never runs with the wrong rules while
     * the document is still on its way.
     */
    ready$: toObservable(computed(() => (isLoading() ? null : settings()))).pipe(
      filter((current): current is TimetrackSettings => !!current),
      take(1),
    ),

    /** Asks the keychain again, for a caller that stored or removed a secret through another route. */
    recheckCredentials: () => secretRevision.update((count) => count + 1),

    setDayTargetMs: (dayTargetMs: number) => patch({ dayTargetMs: clampDayTargetMs(dayTargetMs) }),
    setGapFillMs: (gapFillMs: number) => patch({ gapFillMs: clampGapFillMs(gapFillMs) }),
    setNudgeEnabled: (enabled: boolean) => patch({ nudge: { ...settings().nudge, enabled } }),
    setNudgeAtMinute: (atMinute: number) =>
      patch({ nudge: { ...settings().nudge, atMinute: clampMinuteOfDay(atMinute) } }),
    setJira: (jira: TimetrackJiraSettings) => patch({ jira }),
    setGoogle: (google: TimetrackGoogleSettings) => patch({ google }),
    setGitLab: (gitlab: TimetrackGitLabSettings) => patch({ gitlab }),
    setReasoning: (reasoning: TimetrackReasoningSettings) => patch({ reasoning }),
    setTicket: (ticket: TimetrackTicketSettings) => patch({ ticket }),
    setKeepDefaultExclusionRules: (keepDefaultExclusionRules: boolean) => patch({ keepDefaultExclusionRules }),
    setLockWindow: (lockWindow: boolean) => patch({ lockWindow }),
    setLockAfterIdleMs: (lockAfterIdleMs: number) => patch({ lockAfterIdleMs: clampLockAfterIdleMs(lockAfterIdleMs) }),

    addExclusionRule: (rule: TimetrackExclusionRule) => {
      const rules = settings().exclusionRules;

      if (rules.some((existing) => sameRule(existing, rule))) return;

      patch({ exclusionRules: [...rules, rule] });
    },

    removeExclusionRule: (rule: TimetrackExclusionRule) =>
      patch({ exclusionRules: settings().exclusionRules.filter((existing) => !sameRule(existing, rule)) }),

    addGitScanRoot: (root: string) => {
      const trimmed = root.trim();
      const roots = settings().gitScanRoots;

      if (!trimmed || roots.includes(trimmed)) return;

      patch({ gitScanRoots: [...roots, trimmed] });
    },

    removeGitScanRoot: (root: string) =>
      patch({ gitScanRoots: settings().gitScanRoots.filter((existing) => existing !== root) }),

    setMeetingIssueKey: (issueKey: string) => patch({ meetingIssueKey: issueKey.trim().toUpperCase() }),

    /**
     * Writes the projects a picker chose. It is one write of the whole list rather than an add and a
     * remove: the control is a multi-select, and the list it holds is the answer.
     */
    setFavoriteProjects: (projects: readonly { key: string; name?: string }[]) =>
      apply(withFavoriteProjects({ settings: settings(), projects })),

    removeFavoriteProject: (key: string) => apply(withoutFavoriteProject({ settings: settings(), key })),

    addAttributionRule: (rule: AttributionRule) => apply(withAttributionRule({ settings: settings(), rule })),
    removeAttributionRule: (id: string) => apply(withoutAttributionRule({ settings: settings(), id })),

    addProjectLink: (options: { path: string; target: ProjectLinkTarget }) => {
      const path = options.path.trim();

      if (!path) return;

      apply(
        withProjectLink({
          settings: settings(),
          link: { id: `link-${path}#${Date.now()}`, path, target: options.target, createdAt: new Date() },
        }),
      );
    },

    removeProjectLink: (id: string) => apply(withoutProjectLink({ settings: settings(), id })),

    saveJiraToken: (token: string) => secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.jiraToken, value: token.trim() }),
    saveTempoToken: (token: string) =>
      secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.tempoToken, value: token.trim() }),
    forgetJiraToken: () => secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.jiraToken, value: null }),
    forgetTempoToken: () => secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.tempoToken, value: null }),
    saveGoogleClientSecret: (secret: string) =>
      secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.googleClientSecret, value: secret.trim() }),
    forgetGoogleClientSecret: () => secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.googleClientSecret, value: null }),
    saveGitLabToken: (token: string) =>
      secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.gitlabToken, value: token.trim() }),
    forgetGitLabToken: () => secretWrites$.next({ key: TIMETRACK_SECRET_KEYS.gitlabToken, value: null }),
  };
});

export const injectTimetrackSettings = /* @__PURE__ */ toInjectFn(SETTINGS_DEF);
