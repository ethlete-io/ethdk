import {
  AgentLogPass,
  AgentSessionCursor,
  AgentSessionLogReader,
  CollectedEvent,
  DayNudgeRecord,
  DayReviewEdits,
  EditorCli,
  ProcessSpec,
  SyncedWorklog,
  TIMETRACK_SECRET_KEYS,
  TempoDayCoverage,
  TimerRun,
  TimetrackRequest,
  TimetrackResponse,
  TimetrackSettings,
  dedupeKeyOf,
} from '@ethlete/timetrack';
import {
  FakeAgentLog,
  TIMETRACK_E2E_BACKEND_KEY,
  TIMETRACK_E2E_SEED_KEY,
  cliNotInstalledMessage,
  createFakeWorld,
  isEditorSpec,
  isGhSpec,
  isGlabSpec,
  parseWorldSeed,
  respond,
  runFakeEditor,
  runFakeGh,
  runFakeGit,
  runFakeGlab,
} from '@ethlete/timetrack/testing';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { HostPorts } from '../host/ports';

const ok = <T>(value: T): Observable<T> => of(value);
const done = (): Observable<void> => of(undefined);

/**
 * Serves one provider's seeded session logs. A read never yields a line the seed does not hold, so a
 * collector's cursor lands where a real one would.
 */
const fakeLogReader = (logs: FakeAgentLog[]): AgentSessionLogReader => ({
  logs$: ({ modifiedAfter }) =>
    ok(
      logs
        .map((log) => ({ id: log.id, path: log.path, modifiedAt: new Date(log.modifiedAt) }))
        .filter((ref) => !modifiedAfter || ref.modifiedAt > modifiedAfter),
    ),
  readLines$: ({ ref, fromLine }) => {
    const lines = (logs.find((log) => log.path === ref.path)?.lines ?? []).slice(fromLine);

    return ok({ lines, nextLine: fromLine + lines.length });
  },
});

const seedFromWindow = () =>
  parseWorldSeed((globalThis as Record<string, unknown>)[TIMETRACK_E2E_SEED_KEY] as string | undefined);

/**
 * An in-memory stand-in for the whole desktop host, so the window runs in a plain browser.
 *
 * Nothing here reaches a network, a keychain, a database or a process. It exists for the e2e suite
 * and for `main.e2e.ts` alone — the production entry never imports it, which is what keeps it out of
 * the shipped bundle.
 */
export const createFakePorts = (): HostPorts => {
  const world = createFakeWorld(seedFromWindow());
  const { backend } = world;
  const events = [...world.events];
  const dedupeKeys = new Set(events.map(dedupeKeyOf).filter((key): key is string => key !== null));
  const cursorsByPass = new Map<AgentLogPass, Map<string, AgentSessionCursor>>();
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
  let settings: TimetrackSettings = world.settings;
  let pausedAt: Date | null = null;
  let reasoningRuns = 0;

  (globalThis as Record<string, unknown>)[TIMETRACK_E2E_BACKEND_KEY] = backend;

  /**
   * Appends what the store does not already hold, and answers how many rows were new. The real store
   * refuses a second row under one dedupe key, so a fake that appends blindly would let a collector's
   * re-read double every turn it re-parses.
   */
  const appendEvents = (appended: readonly CollectedEvent[]) => {
    let added = 0;

    for (const event of appended) {
      const key = dedupeKeyOf(event);

      if (key !== null && dedupeKeys.has(key)) continue;
      if (key !== null) dedupeKeys.add(key);

      events.push(event);
      added += 1;
    }

    return added;
  };

  return {
    transport: { request$: <T>(request: TimetrackRequest) => ok(respond(backend, request) as TimetrackResponse<T>) },

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
        appendEvents(appended);

        return done();
      },
      appendCounted$: (appended) => ok(appendEvents(appended)),
      appendWithCursors$: (options) => {
        const added = appendEvents(options.events);
        const held = cursorsByPass.get(options.pass) ?? new Map<string, AgentSessionCursor>();

        for (const cursor of options.cursors) held.set(cursor.id, cursor);

        cursorsByPass.set(options.pass, held);

        return ok(added);
      },
      deleteEventsBefore$: () => ok(0),
      oldestEventAt$: () => ok(events[0]?.at ?? null),
      titlesAfterId$: (afterId, limit) =>
        ok(
          events
            .flatMap((event, index) =>
              'title' in event && typeof event.title === 'string' ? [{ id: index + 1, title: event.title }] : [],
            )
            .filter((row) => row.id > afterId)
            .slice(0, limit),
        ),
      setTitles$: (rows) => {
        for (const row of rows) {
          const event = events[row.id - 1];

          if (event) events[row.id - 1] = { ...event, title: row.title } as CollectedEvent;
        }

        return ok(rows.length);
      },
      bySource$: () =>
        ok(
          [...new Set(events.map((event) => event.source))].map((source) => {
            const held = events.filter((event) => event.source === source);

            return {
              source,
              count: held.length,
              latestAt: held.reduce<Date | null>(
                (newest, event) => (!newest || event.at > newest ? event.at : newest),
                null,
              ),
            };
          }),
        ),
      cursors$: (pass) => ok([...(cursorsByPass.get(pass)?.values() ?? [])]),
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

    processes: {
      run$: (spec: ProcessSpec) => {
        if (isGlabSpec(spec)) {
          return world.glab.installed
            ? ok(runFakeGlab({ backend, spec, state: world.glab }))
            : throwError(() => cliNotInstalledMessage('glab'));
        }

        if (isGhSpec(spec)) {
          return world.gh.installed
            ? ok(runFakeGh({ spec, state: world.gh }))
            : throwError(() => cliNotInstalledMessage('gh'));
        }

        if (isEditorSpec(spec)) {
          const editor = world.editors[spec.command as EditorCli];

          return editor.onPath ? ok(runFakeEditor(editor)) : throwError(() => cliNotInstalledMessage(spec.command));
        }

        if (isReasoningSpec(spec)) reasoningRuns += 1;

        const stdout = isReasoningSpec(spec)
          ? fakeReasoningAnswer(spec, reasoningRuns)
          : spec.command === 'git'
            ? runFakeGit(backend, spec)
            : EMPTY_AGENT_ANSWER;

        return ok({ code: 0, stdout, stderr: '' });
      },
    },

    agentLogs: fakeLogReader(world.agentLogs),

    codexLogs: fakeLogReader(world.codexLogs),

    collection: {
      state$: () => ok({ pausedAt }),
      setPaused$: (paused, whenPaused) => {
        pausedAt = paused ? whenPaused : null;

        return ok({ pausedAt });
      },
    },

    git: {
      repos$: () => ok({ repos: [backend.git.repoPath, ...backend.git.extraRepos], kind: 'watching', detail: null }),
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

    // A browser tab has no second window to open, so the toggle reports one that never opens. The
    // readout stream is silent for the same reason: nothing here has a window to publish to.
    widget: {
      open$: () => done(),
      close$: () => done(),
      isOpen$: () => ok(false),
      revealApp$: () => done(),
      publish$: () => done(),
      readout$: () => EMPTY,
      announceReady$: () => done(),
      ready$: () => EMPTY,
    },

    windows: {
      batch$: (afterSeq) => ok({ events: [], throughSeq: afterSeq, dropped: 0 }),
      status$: () => ok(world.windowSource),
      requestAccessibility$: () => ok(true),
    },

    calls: {
      batch$: (afterSeq) => ok({ events: [], throughSeq: afterSeq, dropped: 0 }),
      status$: () => ok({ kind: 'none', detail: null }),
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

    /** Unlocked, so a scenario reaches the view it is about rather than a password prompt. */
    windowLock: {
      state$: () => ok({ locked: false, promptsItself: false, available: true }),
      lock$: () => done(),
      unlock$: () => ok(true),
    },
  };
};

/** The shape the reasoning provider validates. Nothing is proposed, and that is a complete answer. */
const EMPTY_AGENT_ANSWER = '{"structured_output":{"answers":[]}}';

/**
 * A reasoning call, told apart from a ticket-writing one by what it sends: only the day's question
 * carries `contexts`. Both spawn the same CLI with the same flags, so the payload is the difference.
 */
const isReasoningSpec = (spec: ProcessSpec) => spec.command !== 'git' && !!spec.stdin?.includes('"contexts"');

/**
 * What a reasoning run answers, so a second run is observable in the UI.
 *
 * The first run proposes nothing, which is the case the empty answer covers. A later run names the
 * first candidate for the first context — the difference a test reads to prove that pressing the
 * button a second time really spawned a second run.
 */
const fakeReasoningAnswer = (spec: ProcessSpec, run: number) => {
  if (run < 2) return EMPTY_AGENT_ANSWER;

  const request = JSON.parse(spec.stdin ?? '{}') as {
    contexts?: { id: string }[];
    candidates?: { issueKey: string }[];
  };
  const context = request.contexts?.[0];
  const candidate = request.candidates?.[0];

  if (!context || !candidate) return EMPTY_AGENT_ANSWER;

  const answers = JSON.stringify([
    { id: context.id, issueKey: candidate.issueKey, reason: 'the branch reads like that issue' },
  ]);

  return `{"structured_output":{"answers":${answers}}}`;
};
