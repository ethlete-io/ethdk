import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { ActivityBlock, ActivityContext } from '../model/block';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent, CollectedEvent } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { StandIn } from '../model/stand-in';
import { buildRows } from './build-rows';
import { CALL_LANE_KEY, TIMER_LANE_KEY } from './lane';
import { checkDay } from './round';

const at = (hour: number, minute = 0) => new Date(2026, 8, 10, hour, minute);

const block = (options: { from: Date; to: Date; context: ActivityContext }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: options.context,
  evidence: [],
});

const HUDDLE: CallWindow = {
  from: at(10),
  to: at(11),
  appId: 'com.slack.Slack',
  title: 'Huddle | Braune Digital',
  attendedMs: 30 * 60_000,
  countsAsWork: true,
  isPresence: true,
};

describe('buildRows with no-work-context applications', () => {
  it('proposes no row for the application itself', () => {
    const rows = buildRows({
      blocks: [block({ from: at(9), to: at(10), context: { appId: 'com.slack.Slack' } })],
      events: [],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.proposals).toEqual([]);
    expect(rows.unnamed).toEqual([]);
  });

  it('keeps the call the application held', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { appId: 'com.slack.Slack' } })],
      events: [],
      calls: [HUDDLE],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.calls).toHaveLength(1);
    expect(rows.calls[0]?.group.observedMs).toBe(60 * 60_000);
  });

  it('warns of no double count for a call whose own application proposes nothing', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { appId: 'com.slack.Slack' } })],
      events: [],
      calls: [HUDDLE],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.calls[0]?.overlapMs).toBe(0);
  });
});

describe('buildRows with a transient window over the work', () => {
  const POPUP = 'chrome-hhieiojnefblcnbdbmeamnljodladlem-Default';
  const OCCURRENCE: CalendarOccurrenceEvent = {
    at: at(10),
    until: at(11),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'one',
    title: 'weekly',
    accepted: true,
  };

  const laneKeys = (rows: ReturnType<typeof buildRows>) =>
    [...rows.proposals, ...rows.unnamed].map((row) => row.laneKey);

  it('gives it no lane of its own', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('gives it no lane when a call over a meeting runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [OCCURRENCE],
      calls: [HUDDLE],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(rows.calls[0]?.meeting?.event.title).toBe('weekly');
    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('asks about the meeting rather than billing it when no call was heard', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [OCCURRENCE],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(rows.unobserved.map((entry) => entry.event.title)).toEqual(['weekly']);
    expect(rows.calls).toEqual([]);
  });

  it('gives it no lane when a timer runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
      timerRuns: [{ id: 'run', issueKey: 'ABC-1', from: at(10), to: at(11) }],
    });

    expect(rows.timers).toHaveLength(1);
    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('draws it in the lane it interrupted', () => {
    const context: ActivityContext = { repoPath: '/dev/a', branch: 'main' };
    const rows = buildRows({
      blocks: [
        block({ from: at(10), to: at(10, 10), context }),
        block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } }),
        block({ from: at(10, 11), to: at(11), context }),
      ],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(laneKeys(rows)).toEqual(['repo:/dev/a']);
  });
});

describe('buildRows with a call a rule excluded', () => {
  const ROOM: CallWindow = { ...HUDDLE, title: 'Open Room #1 | Braune Digital', countsAsWork: false };

  it('draws the room as a row of its own', () => {
    const rows = buildRows({ blocks: [], events: [], calls: [ROOM] });

    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.laneKey).toBe(CALL_LANE_KEY);
    expect(rows.unnamed[0]?.description).toContain('Open Room #1');
    expect(rows.unnamed[0]?.excluded).toBe(true);
  });

  it('is not time the day reports as waiting for a name', () => {
    const rows = buildRows({ blocks: [], events: [], calls: [ROOM] });
    const check = checkDay({ proposals: rows.proposals, unattributed: rows.unattributed });

    expect(check.unattributedMs).toBe(0);
    expect(check.warnings.map((warning) => warning.kind)).not.toContain('unattributed-time');
  });

  it('lets an open room say nothing about whether anybody was at the machine', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { repoPath: '/dev/a', branch: 'main' } })],
      events: [],
      calls: [ROOM],
    });
    const worked = rows.unattributed.find((group) => group.laneKey !== CALL_LANE_KEY);

    expect(worked?.attended).toBe(false);
  });
});

describe('buildRows with a rule naming a stand-in', () => {
  const STAND_IN: StandIn = {
    id: 'stand-in-1',
    name: 'The feature with no ticket',
    state: 'open',
    days: [],
    author: 'user',
    createdAt: at(8),
  };

  const RULE: AttributionRule = {
    id: 'rule-1',
    repoPath: '/dev/a',
    target: { kind: 'stand-in', standInId: STAND_IN.id },
    author: 'user',
    createdAt: at(8),
  };

  const WORK = [block({ from: at(9), to: at(10), context: { repoPath: '/dev/a', branch: 'no-key-here' } })];

  it('names the row with the stand-in and leaves it unbookable', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [STAND_IN] });

    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.standInId).toBe(STAND_IN.id);
    expect(rows.proposals).toEqual([]);
  });

  it('leaves the row unnamed when the stand-in the rule points at is gone', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [] });

    expect(rows.unnamed[0]?.standInId).toBeUndefined();
  });

  it('takes the row out of the work the day still has to ask about', () => {
    const named = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [STAND_IN] });
    const gone = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [] });

    expect(named.unattributed).toEqual([]);
    expect(gone.unattributed).toHaveLength(1);
  });
});

describe('buildRows with a stand-in a sibling checkout holds', () => {
  const FRONTEND = '/home/tom/dev/fifagg/fifagg-frontend';

  const link = (path: string): TimetrackProjectLink => ({
    id: `link-${path}`,
    path,
    target: { kind: 'project', projectKey: 'FIFAGG' },
    createdAt: at(8),
  });

  const BRACKET_CHALLENGE: StandIn = {
    id: 'stand-in:1789989837130:specs-main-context-tracks-20260819-bracket-challenge',
    name: 'Bracket challenge',
    openedFor: '/home/tom/dev/fifagg/specs',
    openedForBranch: 'main',
    openedForWorkPath: 'context/tracks/20260819_bracket-challenge',
    projectKey: 'FIFAGG',
    state: 'open',
    days: [],
    author: 'app',
    createdAt: at(8),
  };

  it('names the band with the stand-in rather than an issue of another project seen during it', () => {
    const rows = buildRows({
      blocks: [
        block({
          from: at(9),
          to: at(10),
          context: { repoPath: FRONTEND, branch: 'feature/20260819_bracket-challenge' },
        }),
      ],
      events: [],
      links: [link(FRONTEND), link('/home/tom/dev/fifagg/specs')],
      standIns: [BRACKET_CHALLENGE],
      activity: [{ kind: 'issue-view', issueKey: 'FIP-2867', at: at(9, 30), detail: 'viewed FIP-2867' }],
    });

    expect(rows.proposals).toEqual([]);
    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.standInId).toBe(BRACKET_CHALLENGE.id);
  });
});

describe('buildRows on a day that is still running', () => {
  const SDK = '/dev/sdk';
  const APP = '/dev/app';
  const BACKGROUND: AttributionRule = {
    id: 'rule-sdk',
    repoPath: SDK,
    target: { kind: 'issue', issueKey: 'ET-772' },
    author: 'user',
    createdAt: at(8),
  };
  const FOREGROUND: AttributionRule = {
    id: 'rule-app',
    repoPath: APP,
    target: { kind: 'issue', issueKey: 'FIFAGG-1' },
    author: 'user',
    createdAt: at(8),
  };

  const dayOptions = (foregroundEnd: Date) => ({
    blocks: [
      block({ from: at(13), to: at(17), context: { repoPath: SDK, branch: 'next' } }),
      block({ from: at(13, 30), to: foregroundEnd, context: { repoPath: APP, branch: 'next' } }),
    ],
    events: [],
    rules: [BACKGROUND, FOREGROUND],
    cut: { backgroundProjects: ['ET'] },
  });

  const day = (foregroundEnd: Date) => buildRows(dayOptions(foregroundEnd));

  const drawn = (foregroundEnd: Date) => {
    const rows = day(foregroundEnd);

    return [...rows.proposals, ...rows.unnamed]
      .map((row) => ({ id: row.id, from: row.from, to: row.to }))
      .sort((a, b) => a.from.getTime() - b.from.getTime() || a.id.localeCompare(b.id));
  };

  it('draws the band the cut left over the same minutes either way', () => {
    expect(drawn(at(16, 23)).map((row) => [row.from, row.to])).toEqual(
      drawn(at(16, 22)).map((row) => [row.from, row.to]),
    );
  });

  it('keeps every row id still while the foreground band it was cut against grows', () => {
    expect(drawn(at(16, 23)).map((row) => row.id)).toEqual(drawn(at(16, 22)).map((row) => row.id));
  });

  const sdkLane = (foregroundEnd: Date) => {
    const rows = buildRows(dayOptions(foregroundEnd));
    const lane = rows.behind[0]?.laneKey;

    return [...rows.proposals, ...rows.unnamed]
      .filter((row) => row.laneKey === lane)
      .map((row) => ({ from: row.from, to: row.to }))
      .concat(rows.behind.map((stretch) => ({ from: stretch.from, to: stretch.to })))
      .sort((a, b) => a.from.getTime() - b.from.getTime());
  };

  const running = (foregroundEnd: Date, observedTo: Date) =>
    buildRows({
      ...dayOptions(foregroundEnd),
      blocks: [
        block({ from: at(13), to: observedTo, context: { repoPath: SDK, branch: 'next' } }),
        block({ from: at(13, 30), to: foregroundEnd, context: { repoPath: APP, branch: 'next' } }),
      ],
    });

  it.each([33, 35, 37, 39])('starts no row after the last minute the day saw, at a raw end of 16:%i', (minute) => {
    const rows = running(at(16, minute), at(16, 40));

    for (const row of [...rows.proposals, ...rows.unnamed]) {
      expect(row.from.getTime()).toBeLessThan(at(16, 40).getTime());
    }
  });

  it('gives the booked increment to the band that still has evidence in it', () => {
    const rows = running(at(16, 37), at(16, 40));
    const drawnRows = [...rows.proposals, ...rows.unnamed].sort((a, b) => a.from.getTime() - b.from.getTime());

    expect(drawnRows.map((row) => [row.from, row.to])).toEqual([
      [at(13), at(13, 30)],
      [at(13, 30), at(16, 30)],
      [at(16, 30), at(16, 45)],
    ]);
  });

  it('draws no background band in the increment the day is still in', () => {
    const rows = buildRows({
      ...dayOptions(at(16, 30)),
      blocks: [
        block({ from: at(13), to: at(16, 36), context: { repoPath: SDK, branch: 'next' } }),
        block({ from: at(13, 30), to: at(16, 30), context: { repoPath: APP, branch: 'next' } }),
      ],
      cut: { backgroundProjects: ['ET'], through: at(16, 36) },
    });

    expect(
      [...rows.proposals, ...rows.unnamed]
        .filter((row) => row.laneKey === `repo:${SDK}`)
        .map((row) => [row.from, row.to]),
    ).toEqual([[at(13), at(13, 30)]]);
  });

  it.each([18, 22, 23, 28, 31, 38])('leaves the lane whole with the foreground band open at 16:%i', (minute) => {
    const covered = sdkLane(at(16, minute));

    expect(covered[0]?.from).toEqual(at(13));
    expect(covered[covered.length - 1]?.to).toEqual(at(17));
    expect(covered.slice(1).map((span, index) => span.from.getTime() - (covered[index]?.to.getTime() ?? 0))).toEqual(
      covered.slice(1).map(() => 0),
    );
  });
});

describe('buildRows with a timed run', () => {
  it('proposes no row for a run of seconds, which would otherwise book a whole increment', () => {
    const rows = buildRows({
      blocks: [],
      events: [],
      timerRuns: [{ id: 'run', from: at(10, 40), to: new Date(+at(10, 40) + 1855) }],
    });

    expect(rows.timers).toHaveLength(1);
    expect(rows.unnamed).toEqual([]);
    expect(rows.proposals).toEqual([]);
  });

  it('draws a real run in the timer lane rather than among the work nothing placed', () => {
    const rows = buildRows({
      blocks: [],
      events: [],
      timerRuns: [{ id: 'run', from: at(10), to: at(11) }],
    });

    expect(rows.unnamed.map((row) => row.laneKey)).toEqual([TIMER_LANE_KEY]);
  });
});

describe('buildRows with a rule naming an issue for work nobody watched', () => {
  const RULE: AttributionRule = {
    id: 'rule-1',
    repoPath: '/dev/a',
    target: { kind: 'issue', issueKey: 'FIP-2178' },
    author: 'user',
    createdAt: at(8),
  };

  const WORK = [block({ from: at(9), to: at(10), context: { repoPath: '/dev/a', branch: 'no-key-here' } })];

  it('books nothing, because nobody was at the machine', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE] });

    expect(rows.proposals).toEqual([]);
    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.unattended).toBe(true);
  });

  it('keeps the key the rule named, so the user does not type it again', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE] });

    expect(rows.unnamed[0]?.withheldIssueKey).toBe('FIP-2178');
  });

  it('withholds nothing where no rung named the band', () => {
    const rows = buildRows({ blocks: WORK, events: [] });

    expect(rows.unnamed[0]?.unattended).toBe(true);
    expect(rows.unnamed[0]?.withheldIssueKey).toBeUndefined();
  });
});

describe('buildRows with a break as long as the fillable gap', () => {
  const WORK = [
    block({ from: at(9), to: at(9, 30), context: { repoPath: '/dev/a', branch: 'main' } }),
    block({ from: at(9, 45), to: at(10, 15), context: { repoPath: '/dev/a', branch: 'main' } }),
  ];
  const RULE: AttributionRule = {
    id: 'rule-1',
    repoPath: '/dev/a',
    target: { kind: 'issue', issueKey: 'FIP-1' },
    author: 'user',
    createdAt: at(8),
  };
  const IDLE: CollectedEvent[] = [
    { at: at(9, 30), source: 'idle', kind: 'idle-start' },
    { at: at(9, 45), source: 'idle', kind: 'idle-end' },
  ];

  it('fills no minute of the break', () => {
    const rows = buildRows({
      blocks: WORK,
      events: IDLE,
      rules: [RULE],
      breaks: [{ from: at(9, 30), to: at(9, 45) }],
    });

    expect(rows.filledMs).toBe(0);
  });
});

describe('buildRows after a restart that lost the end of an idle stretch', () => {
  const RULE: AttributionRule = {
    id: 'rule-1',
    repoPath: '/dev/a',
    target: { kind: 'issue', issueKey: 'FIP-2178' },
    author: 'user',
    createdAt: at(8),
  };
  const EVENTS: CollectedEvent[] = [
    { at: at(12, 36), source: 'idle', kind: 'idle-start' },
    { at: at(14, 7), source: 'window', kind: 'window-focus', appId: 'code', title: 'a.ts - a - Code' },
  ];

  it('keeps the issue key of a band after the first window focus', () => {
    const rows = buildRows({
      blocks: [block({ from: at(14, 10), to: at(14, 40), context: { repoPath: '/dev/a', branch: 'no-key-here' } })],
      events: EVENTS,
      rules: [RULE],
    });

    expect(rows.proposals).toHaveLength(1);
    expect(rows.proposals[0]?.issueKey).toBe('FIP-2178');
    expect(rows.unnamed).toEqual([]);
  });
});

describe('buildRows with activity on another branch inside a rule-named band', () => {
  const REPO = '/dev/app';
  const WORKTREE = '/dev/app-login';

  const STAND_IN: StandIn = {
    id: 'stand-in-login',
    name: 'Login captcha',
    state: 'open',
    days: [],
    author: 'app',
    createdAt: at(8),
  };

  const rule = (options: { repoPath: string; branch: string; target: AttributionRule['target'] }): AttributionRule => ({
    id: `rule-${options.branch}`,
    ...options,
    author: 'user',
    createdAt: at(8),
  });

  const NAMED = rule({ repoPath: REPO, branch: 'dev-feature', target: { kind: 'issue', issueKey: 'FIP-3006' } });
  const WORK = [block({ from: at(14, 15), to: at(15), context: { repoPath: REPO, branch: 'dev-feature' } })];

  const FOCUS: CollectedEvent = {
    at: at(14, 30),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'a.ts - app - Code',
  };

  const mergeRequest = (branch: string, minute: number): CollectedEvent => ({
    source: 'gitlab',
    kind: 'merge-request-activity',
    at: at(14, minute),
    eventId: `mr-${branch}`,
    action: 'accepted',
    mergeRequestIid: '1072',
    branch,
  });

  it('disputes the band with the open stand-in a worktree rule names for the merge request branch', () => {
    const rows = buildRows({
      blocks: WORK,
      events: [FOCUS, mergeRequest('feat/login', 38)],
      rules: [
        NAMED,
        rule({ repoPath: WORKTREE, branch: 'feat/login', target: { kind: 'stand-in', standInId: STAND_IN.id } }),
      ],
      standIns: [STAND_IN],
      worktrees: { [WORKTREE]: REPO },
    });

    expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
    expect(rows.proposals[0]?.disputedStandInId).toBe(STAND_IN.id);
  });

  it('disputes the band with the issue a rule names for a merge request branch of its own checkout', () => {
    const rows = buildRows({
      blocks: WORK,
      events: [FOCUS, mergeRequest('fix/audit', 45)],
      rules: [NAMED, rule({ repoPath: REPO, branch: 'fix/audit', target: { kind: 'issue', issueKey: 'FIP-3100' } })],
    });

    expect(rows.proposals[0]?.disputedIssueKey).toBe('FIP-3100');
  });

  it('disputes the band with the issue a rule names for a branch rebased without a checkout', () => {
    const rebase: CollectedEvent = {
      at: at(14, 29),
      source: 'git',
      kind: 'git-branch-update',
      repoPath: REPO,
      branch: 'feat/login',
      action: 'rebase (finish): refs/heads/feat/login onto 57f59f5',
    };
    const rows = buildRows({
      blocks: WORK,
      events: [FOCUS, rebase],
      rules: [NAMED, rule({ repoPath: REPO, branch: 'feat/login', target: { kind: 'issue', issueKey: 'FIP-3100' } })],
    });

    expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
    expect(rows.proposals[0]?.disputedIssueKey).toBe('FIP-3100');
    expect(rows.proposals[0]?.evidence.map((item) => item.detail)).toContain('rebase (finish) on `feat/login`');
  });

  describe('when an agent session merged into another branch without a checkout', () => {
    const SESSION_WORK = [
      block({ from: at(14, 15), to: at(15), context: { repoPath: REPO, branch: 'dev-feature', session: 's-1' } }),
    ];
    const LOGIN = rule({ repoPath: REPO, branch: 'feat/login', target: { kind: 'issue', issueKey: 'FIP-3100' } });
    const merge = (branch: string, repoPath = REPO): CollectedEvent => ({
      at: at(14, 40),
      source: 'git',
      kind: 'git-branch-update',
      repoPath,
      branch,
      action: `commit (merge): Merge remote-tracking branch 'origin/next' into ${branch}`,
    });

    it('books the branch the session wrote to and disputes the rule of the checked-out branch', () => {
      const rows = buildRows({
        blocks: SESSION_WORK,
        events: [FOCUS, merge('feat/unruled'), merge('feat/login')],
        rules: [NAMED, LOGIN],
      });

      expect(rows.proposals[0]?.issueKey).toBe('FIP-3100');
      expect(rows.proposals[0]?.disputedIssueKey).toBe('FIP-3006');
    });

    it('keeps the rule when the session also committed on the checked-out branch', () => {
      const commit: CollectedEvent = {
        at: at(14, 50),
        source: 'git',
        kind: 'git-commit',
        repoPath: REPO,
        branch: 'dev-feature',
        sha: 'abc1234',
        subject: 'fix: A change',
      };
      const rows = buildRows({
        blocks: SESSION_WORK,
        events: [FOCUS, merge('feat/login'), commit],
        rules: [NAMED, LOGIN],
      });

      expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
      expect(rows.proposals[0]?.disputedIssueKey).toBe('FIP-3100');
    });

    it('keeps the issue and disputes the stand-in when the written branch names only a stand-in', () => {
      const rows = buildRows({
        blocks: SESSION_WORK,
        events: [FOCUS, merge('feat/login')],
        rules: [NAMED, { ...LOGIN, target: { kind: 'stand-in', standInId: STAND_IN.id } }],
        standIns: [STAND_IN],
      });

      expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
      expect(rows.proposals[0]?.disputedStandInId).toBe(STAND_IN.id);
    });

    it('keeps the rule when a linked worktree owns the branch the write landed on', () => {
      const rows = buildRows({
        blocks: SESSION_WORK,
        events: [FOCUS, merge('feat/login', WORKTREE)],
        rules: [NAMED, { ...LOGIN, repoPath: WORKTREE }],
        worktrees: { [WORKTREE]: REPO },
      });

      expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
      expect(rows.proposals[0]?.disputedIssueKey).toBe('FIP-3100');
    });
  });

  it('leaves the band alone when the branch belongs to another checkout or to a resolved stand-in', () => {
    const rows = buildRows({
      blocks: WORK,
      events: [FOCUS, mergeRequest('feat/login', 38), mergeRequest('fix/audit', 45)],
      rules: [
        NAMED,
        rule({ repoPath: '/dev/other', branch: 'fix/audit', target: { kind: 'issue', issueKey: 'FIP-3100' } }),
        rule({ repoPath: REPO, branch: 'feat/login', target: { kind: 'stand-in', standInId: STAND_IN.id } }),
      ],
      standIns: [{ ...STAND_IN, state: 'resolved', issueKey: 'FIP-3200' }],
    });

    expect(rows.proposals[0]?.issueKey).toBe('FIP-3006');
    expect(rows.proposals[0]?.disputedIssueKey).toBeUndefined();
    expect(rows.proposals[0]?.disputedStandInId).toBeUndefined();
  });
});
