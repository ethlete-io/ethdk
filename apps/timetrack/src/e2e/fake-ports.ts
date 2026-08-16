import {
  CollectedEvent,
  DayNudgeRecord,
  DayReviewEdits,
  ProcessSpec,
  SyncedWorklog,
  TIMETRACK_SECRET_KEYS,
  TempoDayCoverage,
  TimerRun,
  TimetrackRequest,
  TimetrackResponse,
  TimetrackSettings,
} from '@ethlete/timetrack';
import { Observable, of } from 'rxjs';
import { HostPorts } from '../host/ports';
import {
  E2E_ISSUE_KEY,
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_BRANCH,
  E2E_REPO,
  e2eEvents,
  e2eRespond,
  e2eSettings,
} from './world';

const ok = <T>(value: T): Observable<T> => of(value);
const done = (): Observable<void> => of(undefined);

/**
 * An in-memory stand-in for the whole desktop host, so the window runs in a plain browser.
 *
 * Nothing here reaches a network, a keychain, a database or a process. It exists for the e2e suite
 * and for `main.e2e.ts` alone — the production entry never imports it, which is what keeps it out of
 * the shipped bundle.
 */
export const createFakePorts = (): HostPorts => {
  const events = [...e2eEvents()];
  const ledger = new Map<string, SyncedWorklog[]>();
  const edits = new Map<string, DayReviewEdits>();
  const coverage = new Map<string, TempoDayCoverage>();
  const secrets = new Map<string, string>([
    [TIMETRACK_SECRET_KEYS.jiraToken, 'e2e-jira-token'],
    [TIMETRACK_SECRET_KEYS.tempoToken, 'e2e-tempo-token'],
    [TIMETRACK_SECRET_KEYS.gitlabToken, 'e2e-gitlab-token'],
  ]);
  const nudges = new Map<string, DayNudgeRecord>();
  const timers: TimerRun[] = [];
  let settings: TimetrackSettings = e2eSettings();
  let pausedAt: Date | null = null;

  return {
    transport: { request$: <T>(request: TimetrackRequest) => ok(e2eRespond(request) as TimetrackResponse<T>) },

    secrets: {
      read$: (key) => ok(secrets.get(key) ?? null),
      write$: (key, value) => {
        secrets.set(key, value);

        return done();
      },
      has$: (key) => ok(!!secrets.get(key)),
      delete$: (key) => {
        secrets.delete(key);

        return done();
      },
    },

    events: {
      eventsBetween$: (from, to) => ok(events.filter((event) => event.at >= from && event.at < to)),
      append$: (appended: CollectedEvent[]) => {
        events.push(...appended);

        return done();
      },
      appendWithCursors$: (appended) => {
        events.push(...appended);

        return ok(appended.length);
      },
      deleteEventsBefore$: () => ok(0),
      oldestEventAt$: () => ok(events[0]?.at ?? null),
      bySource$: () => ok([]),
      cursors$: () => ok([]),
      compactedThrough$: () => ok(null),
      setCompactedThrough$: () => done(),
    },

    ledger: {
      entriesForDay$: (day) => ok(ledger.get(day) ?? []),
      upsert$: (entries) => {
        for (const entry of entries) {
          const day = ledger.get(entry.day) ?? [];

          ledger.set(entry.day, [...day.filter((held) => held.proposalId !== entry.proposalId), entry]);
        }

        return done();
      },
      remove$: (proposalIds) => {
        const dropped = new Set(proposalIds);

        for (const [day, entries] of ledger) {
          ledger.set(
            day,
            entries.filter((entry) => !dropped.has(entry.proposalId)),
          );
        }

        return done();
      },
    },

    coverage: {
      forDay$: (day) => ok(coverage.get(day) ?? null),
      save$: (next) => {
        coverage.set(next.day, next);

        return done();
      },
    },

    review: {
      editsFor$: (day) => ok(edits.get(day) ?? null),
      save$: (day, next) => {
        edits.set(day, next);

        return done();
      },
      clear$: (day) => {
        edits.delete(day);

        return done();
      },
    },

    settings: {
      read$: () => ok(settings),
      save$: (next) => {
        settings = next;

        return done();
      },
    },

    timers: {
      runsBetween$: (from, to) => ok(timers.filter((run) => run.from >= from && run.from < to)),
      running$: () => ok(timers.find((run) => !run.to) ?? null),
      start$: (startedAt) => {
        const run: TimerRun = { id: `t${timers.length + 1}`, from: startedAt };

        timers.push(run);

        return ok(run);
      },
      stop$: (stoppedAt) => {
        const open = timers.find((run) => !run.to);

        if (open) open.to = stoppedAt;

        return ok(open ?? null);
      },
      label$: (id, label) => {
        const run = timers.find((held) => held.id === id);

        if (run) Object.assign(run, label);

        return done();
      },
    },

    processes: { run$: (spec: ProcessSpec) => ok({ code: 0, stdout: fakeStdout(spec), stderr: '' }) },

    agentLogs: { logs$: () => ok([]), readLines$: () => ok({ lines: [], nextLine: 0 }) },

    collection: {
      state$: () => ok({ pausedAt }),
      setPaused$: (paused, whenPaused) => {
        pausedAt = paused ? whenPaused : null;

        return ok({ pausedAt });
      },
    },

    git: {
      repos$: () => ok({ repos: [E2E_REPO], kind: 'watching', detail: null }),
      changes$: (afterSeq) => ok({ repos: [], seq: afterSeq }),
    },

    nudge: {
      recordFor$: (day) => ok(nudges.get(day) ?? null),
      save$: (record) => {
        nudges.set(record.day, record);

        return done();
      },
      notify$: () => done(),
    },

    oauth: { authorize$: () => ok({ code: 'e2e', redirectUri: 'http://localhost', codeVerifier: 'e2e' }) },

    tray: { setReadout$: () => done() },

    windows: {
      batch$: (afterSeq) => ok({ events: [], throughSeq: afterSeq, dropped: 0 }),
      status$: () => ok({ kind: 'none', detail: null }),
      requestAccessibility$: () => ok(true),
    },

    ingest: {
      batch$: (afterSeq) => ok({ records: [], throughSeq: afterSeq, dropped: 0 }),
      status$: () => ok({ kind: 'none', detail: null, port: null, discoveryPath: null, reporters: [], refused: 0 }),
    },

    windowControls: {
      capabilities$: () => ok({ minimize: false, maximize: false, fullscreen: false }),
      isMaximized$: () => ok(false),
      minimize$: () => done(),
      toggleMaximize$: () => done(),
      close$: () => done(),
    },
  };
};

/** The shape the reasoning provider validates. It answers nothing, so no suggestion is ever offered. */
const EMPTY_AGENT_ANSWER = '{"structured_output":{"answers":[]}}';

/**
 * A repository that is clean, has both fixture branches and pushes to the fixture's GitLab instance.
 * A mutating command answers with success and changes nothing — the fake has no state to change, and
 * a repair test is about what the app plans and reports, not about git.
 */
const FAKE_GIT: Record<string, string> = {
  'status --porcelain': '',
  'for-each-ref --format=%(refname:short) refs/heads': `next\n${E2E_KEYLESS_BRANCH}\nfeat/${E2E_ISSUE_KEY}-user-management\n${E2E_PARENT_BRANCH}\n`,
  remote: 'origin',
  'remote get-url origin': 'git@gitlab.example.com:braune-digital/fut-frontend.git',
  'for-each-ref --format=%(refname:strip=3) refs/remotes/origin': `HEAD\nnext\n${E2E_KEYLESS_BRANCH}\n${E2E_PARENT_BRANCH}\n`,
};

const fakeStdout = (spec: ProcessSpec) => {
  if (spec.command !== 'git') return EMPTY_AGENT_ANSWER;

  const key = spec.args.join(' ');

  const mutating = ['branch ', 'push ', 'switch ', 'fetch '].some((prefix) => key.startsWith(prefix));

  return FAKE_GIT[key] ?? (mutating ? '' : 'e2e@example.com\n');
};
