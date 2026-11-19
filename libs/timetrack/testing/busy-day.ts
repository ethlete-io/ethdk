import { CollectedEvent } from '../src/lib/model/event';
import { ReceivedRange } from '../src/lib/model/received-event';
import { localDayRange } from '../src/lib/review/day';
import { DayReview } from '../src/lib/review/model';
import { reviewDay } from '../src/lib/review/review-day';
import { gitFlowConfigFor } from '../src/lib/settings/attribution';
import { dayBoundaryOf } from '../src/lib/settings/day';
import { DEFAULT_TIMETRACK_SETTINGS } from '../src/lib/settings/model';
import {
  effectiveExclusionRules,
  effectiveMultiPurposeApps,
  effectiveNoWorkContextApps,
  effectiveTransientApps,
} from '../src/lib/settings/rules';
import { mergeDayEvents } from '../src/lib/stream/merge-day-events';
import { StreamDay, streamDay } from '../src/lib/stream/stream-day';

/**
 * Builds a day's rows the way the app's day reader does: merge the paired machines' events, stream
 * the day, review it. Settings are the defaults, so a real dump yields the same work, not the same rows.
 */
export const buildBusyDay = (options: {
  day: string;
  events: readonly CollectedEvent[];
  received?: ReceivedRange;
}): { day: StreamDay; review: DayReview } => {
  const settings = DEFAULT_TIMETRACK_SETTINGS;
  const { to } = localDayRange(options.day, dayBoundaryOf(settings));
  const merged = mergeDayEvents({
    local: options.events,
    received: options.received ?? { events: [], repoKeys: {} },
    keys: {},
    rules: effectiveExclusionRules(settings),
  });
  const repoRoots = [
    ...new Set(
      options.events.flatMap((event) =>
        'repoPath' in event && typeof event.repoPath === 'string' ? [event.repoPath] : [],
      ),
    ),
  ];
  const noWorkContextApps = effectiveNoWorkContextApps(settings);
  const transientApps = effectiveTransientApps(settings);
  const rows = {
    config: gitFlowConfigFor(settings),
    rules: settings.attributionRules,
    standIns: settings.standIns,
    cut: { backgroundProjects: settings.backgroundProjects, through: to },
    patterns: [],
    fill: { maxFillGapMs: settings.gapFillMs },
    meetings: { namings: settings.meetingNamings, callNamings: settings.callNamings },
    noWorkContext: { apps: noWorkContextApps, workApps: [...settings.holdsWorkApps], transientApps },
  };
  const day = streamDay({
    events: merged,
    options: {
      day: options.day,
      repoRoots,
      callRules: settings.callRules,
      noWorkContextApps,
      transientApps,
      multiPurposeApps: effectiveMultiPurposeApps(settings),
      minBreakMs: settings.gapFillMs,
      baseBranches: Object.values(gitFlowConfigFor(settings).baseBranches),
      rows,
    },
  });
  const review = reviewDay({ rows: day.rows, cut: rows.cut, standIns: settings.standIns, day: options.day });

  return { day, review };
};

const BUSY_DAY_COUNTS = {
  'agent-usage': 16000,
  'merge-request-changes': 3400,
  'agent-session': 3000,
  'window-focus': 1200,
  'agent-prompt': 560,
  'git-commit': 470,
  'git-branch-update': 110,
  'merge-request-activity': 50,
} as const;

const syntheticEventsOf = (options: { home: string; day: string }): CollectedEvent[] => {
  const repos = Array.from({ length: 12 }, (_, index) => `${options.home}/dev/repo-${index}`);
  const start = new Date(`${options.day}T07:00:00.000Z`).getTime();
  const spanMs = 11 * 60 * 60 * 1000;
  const events: CollectedEvent[] = [];

  for (const [kind, count] of Object.entries(BUSY_DAY_COUNTS)) {
    for (let index = 0; index < count; index++) {
      const at = new Date(start + Math.floor((index * spanMs) / count));
      const repoPath = repos[index % repos.length] ?? options.home;
      const cwd = `${repoPath}/libs/part-${index % 5}`;
      const sessionId = `session-${index % 60}`;
      const branch = `feature/task-${index % 9}`;

      switch (kind) {
        case 'agent-usage':
          events.push({
            kind,
            source: kind,
            at,
            agentId: `agent-${index % 400}`,
            cwd,
            workedIn: repoPath,
            gitBranch: branch,
            model: 'model',
            provider: 'claude-code',
            sessionId,
            turnId: `turn-${index}`,
            usage: { cacheRead: 60000, cacheWrite: 2000, input: 2, output: 300, thinking: 100 },
          });
          break;
        case 'agent-session':
          events.push({
            kind,
            source: kind,
            at,
            agentId: `agent-${index % 400}`,
            agentTask: `Task ${index % 40}`,
            cwd,
            workedIn: repoPath,
            gitBranch: branch,
            sessionId,
          });
          break;
        case 'agent-prompt':
          events.push({
            kind,
            source: kind,
            at,
            askedBy: 'human',
            cwd,
            workedIn: repoPath,
            gitBranch: branch,
            promptId: `prompt-${index}`,
            provider: 'claude-code',
            sessionId,
          });
          break;
        case 'merge-request-changes':
          events.push({
            kind,
            source: 'git',
            at,
            repoPath,
            eventId: `${index}`,
            projectPath: `group/repo-${index % 12}`,
            mergeRequestIid: `${index % 30}`,
            branch,
            head: `head-${index}`,
            directories: [`libs/part-${index % 5}`],
          });
          break;
        case 'window-focus':
          events.push({ kind, source: 'window', at, appId: `app-${index % 6}`, title: `Window ${index % 50}` });
          break;
        case 'git-commit':
          events.push({
            kind,
            source: 'git',
            at,
            repoPath,
            branch,
            sha: `sha-${index}`,
            subject: `Change ${index}`,
            paths: [`libs/part-${index % 5}/file.ts`],
          });
          break;
        case 'git-branch-update':
          events.push({ kind, source: 'git', at, repoPath, branch, action: 'commit' });
          break;
        case 'merge-request-activity':
          events.push({
            kind,
            source: 'gitlab',
            at,
            eventId: `${index}`,
            action: 'opened',
            projectPath: `group/repo-${index % 12}`,
            mergeRequestIid: `${index % 30}`,
            branch,
          });
          break;
      }
    }
  }

  return events.sort((left, right) => left.at.getTime() - right.at.getTime());
};

/**
 * A day as busy as a heavy real one, about 25k events on this machine and as many from a paired one,
 * made up so it holds nothing private.
 */
export const syntheticBusyDay = (day = '2026-11-19') => ({
  day,
  events: syntheticEventsOf({ home: '/home/me', day }),
  received: {
    events: syntheticEventsOf({ home: '/home/peer', day }).map((event) => ({
      machineId: 'peer-machine',
      machineName: 'Peer',
      event,
    })),
    repoKeys: {},
  } satisfies ReceivedRange,
});
