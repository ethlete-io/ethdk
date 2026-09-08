import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { DEFAULT_EXCLUSION_RULES, applyExclusionRules, exclusionRuleError } from './exclusion';

const window = (appId: string, title: string): CollectedEvent => ({
  at: new Date(2026, 7, 11, 9, 30),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const calendar = (title: string): CollectedEvent => ({
  at: new Date(2026, 7, 11, 10, 0),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: `occ-${title}`,
  until: new Date(2026, 7, 11, 11, 0),
  title,
  accepted: true,
});

const commit: CollectedEvent = {
  at: new Date(2026, 7, 11, 11, 30),
  source: 'git',
  kind: 'git-commit',
  repoPath: '/home/tom/dev/fut-frontend',
  branch: 'feat/FIP-2177-user-management',
  sha: 'abc1234',
  subject: 'feat(user): Add the invite flow',
};

describe('applyExclusionRules', () => {
  it('keeps everything when there are no rules', () => {
    const result = applyExclusionRules({ events: [window('firefox', 'Docs'), commit], rules: [] });

    expect(result.kept).toHaveLength(2);
    expect(result.excluded).toEqual([]);
  });

  it('denies a window by app id, case-insensitively', () => {
    const result = applyExclusionRules({
      events: [window('org.keepassxc.KeePassXC', 'Passwords'), window('firefox', 'Docs')],
      rules: [{ kind: 'app-id', appId: 'ORG.KEEPASSXC.KEEPASSXC' }],
    });

    expect(result.kept.map((event) => ('appId' in event ? event.appId : ''))).toEqual(['firefox']);
    expect(result.excluded).toHaveLength(1);
  });

  it('never carries the title or app id of an excluded event', () => {
    const result = applyExclusionRules({
      events: [window('firefox', 'ACME Bank — Online Banking')],
      rules: [{ kind: 'title-pattern', pattern: 'online banking' }],
    });

    expect(result.excluded[0]).toEqual({
      at: new Date(2026, 7, 11, 9, 30),
      source: 'window',
      kind: 'window-focus',
      rule: { kind: 'title-pattern', pattern: 'online banking' },
    });
    expect(JSON.stringify(result.excluded)).not.toContain('ACME');
  });

  it('tests a title pattern against any event that carries a title', () => {
    const result = applyExclusionRules({
      events: [calendar('Therapy'), commit],
      rules: [{ kind: 'title-pattern', pattern: 'therapy' }],
    });

    expect(result.kept).toEqual([commit]);
    expect(result.excluded[0]?.source).toBe('calendar');
  });

  it('leaves an event with no title and no app id alone', () => {
    const result = applyExclusionRules({
      events: [commit],
      rules: [
        { kind: 'title-pattern', pattern: '.*' },
        { kind: 'app-id', appId: 'firefox' },
      ],
    });

    expect(result.kept).toEqual([commit]);
  });

  it('reports the rule that fired, so settings can explain the gap in a day', () => {
    const result = applyExclusionRules({
      events: [window('com.bitwarden.desktop', 'Vault')],
      rules: DEFAULT_EXCLUSION_RULES,
    });

    expect(result.excluded[0]?.rule).toEqual({ kind: 'app-id', appId: 'com.bitwarden.desktop' });
  });

  it('reports an uncompilable pattern instead of throwing, and keeps collecting', () => {
    const result = applyExclusionRules({
      events: [window('firefox', 'Docs')],
      rules: [{ kind: 'title-pattern', pattern: '(' }],
    });

    expect(result.kept).toHaveLength(1);
    expect(result.invalidRules).toHaveLength(1);
    expect(result.invalidRules[0]?.rule).toEqual({ kind: 'title-pattern', pattern: '(' });
  });

  it('still applies the rules that do compile', () => {
    const result = applyExclusionRules({
      events: [window('firefox', 'Private Browsing')],
      rules: [
        { kind: 'title-pattern', pattern: '(' },
        { kind: 'title-pattern', pattern: 'private browsing' },
      ],
    });

    expect(result.kept).toEqual([]);
    expect(result.invalidRules).toHaveLength(1);
  });
});

describe('exclusionRuleError', () => {
  it('accepts a rule that can match', () => {
    expect(exclusionRuleError({ kind: 'app-id', appId: 'firefox' })).toBeNull();
    expect(exclusionRuleError({ kind: 'title-pattern', pattern: 'online banking' })).toBeNull();
  });

  it('rejects an empty app id and an uncompilable pattern', () => {
    expect(exclusionRuleError({ kind: 'app-id', appId: '   ' })).toBeTruthy();
    expect(exclusionRuleError({ kind: 'title-pattern', pattern: '(' })).toBeTruthy();
  });
});

describe('applyExclusionRules, for a source with no title', () => {
  const heartbeat = (repoPath: string, directory?: string): CollectedEvent => ({
    at: new Date(2026, 7, 11, 14, 0),
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: 'vscode',
    repoPath,
    directory,
    editing: true,
  });

  it('denies an editor heartbeat by the checkout it names', () => {
    const result = applyExclusionRules({
      events: [heartbeat('/home/tom/dev/tax-return'), heartbeat('/home/tom/dev/fut-frontend')],
      rules: [{ kind: 'title-pattern', pattern: 'tax-return' }],
    });

    expect(result.kept).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
  });

  it('denies it by the directory as well as the checkout', () => {
    const result = applyExclusionRules({
      events: [heartbeat('/home/tom/dev/fut-frontend', 'src/billing')],
      rules: [{ kind: 'title-pattern', pattern: 'billing' }],
    });

    expect(result.kept).toEqual([]);
  });

  it('keeps no path in the summary of what it denied', () => {
    const result = applyExclusionRules({
      events: [heartbeat('/home/tom/dev/tax-return', 'invoices')],
      rules: [{ kind: 'title-pattern', pattern: 'tax-return' }],
    });

    expect(Object.keys(result.excluded[0] ?? {}).sort()).toEqual(['at', 'kind', 'rule', 'source']);
    expect(JSON.stringify(result.excluded)).not.toContain('invoices');
  });
});

describe('DEFAULT_EXCLUSION_RULES', () => {
  it('covers password managers, private browsing and banking', () => {
    const result = applyExclusionRules({
      events: [
        window('org.keepassxc.KeePassXC', 'Passwords'),
        window('1Password', 'Vault'),
        window('firefox', 'Search — Mozilla Firefox Private Browsing'),
        window('chromium', 'New Tab — Incognito'),
        window('firefox', 'Sparkasse OnlineBanking'),
      ],
      rules: DEFAULT_EXCLUSION_RULES,
    });

    expect(result.kept).toEqual([]);
    expect(result.invalidRules).toEqual([]);
  });

  it('every default pattern compiles', () => {
    expect(applyExclusionRules({ events: [], rules: DEFAULT_EXCLUSION_RULES }).invalidRules).toEqual([]);
  });
});

describe('applyExclusionRules, on a typed prompt', () => {
  const prompt = (cwd: string, gitBranch?: string): CollectedEvent => ({
    at: new Date(2026, 8, 7, 9, 57),
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: 'claude-code',
    sessionId: 's1',
    promptId: 'prompt_1',
    cwd,
    gitBranch,
  });

  it('tests a title pattern against the checkout the prompt was typed in', () => {
    const result = applyExclusionRules({
      events: [prompt('/home/tom/dev/invoices')],
      rules: [{ kind: 'title-pattern', pattern: 'invoices' }],
    });

    expect(result.kept).toEqual([]);
    expect(result.excluded.map((entry) => entry.kind)).toEqual(['agent-prompt']);
  });

  it('tests a title pattern against the branch as well', () => {
    const result = applyExclusionRules({
      events: [prompt('/home/tom/dev/fut-frontend', 'feat/secret-launch')],
      rules: [{ kind: 'title-pattern', pattern: 'secret-launch' }],
    });

    expect(result.kept).toEqual([]);
  });

  it('keeps a prompt no rule names', () => {
    const kept = prompt('/home/tom/dev/fut-frontend', 'next');

    expect(
      applyExclusionRules({ events: [kept], rules: [{ kind: 'title-pattern', pattern: 'invoices' }] }).kept,
    ).toEqual([kept]);
  });
});

describe("applyExclusionRules, on a turn's token spend", () => {
  const spend = (cwd: string, gitBranch?: string): CollectedEvent => ({
    at: new Date(2026, 7, 17, 9, 0),
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: 'claude-code',
    sessionId: 's1',
    turnId: 'msg_1',
    cwd,
    gitBranch,
    model: 'claude-opus-5',
    usage: { input: 1, output: 10, cacheWrite: 0, cacheRead: 500, thinking: 0 },
  });

  it('tests a title pattern against the checkout the turn ran in', () => {
    const result = applyExclusionRules({
      events: [spend('/home/tom/dev/invoices')],
      rules: [{ kind: 'title-pattern', pattern: 'invoices' }],
    });

    expect(result.kept).toEqual([]);
    expect(result.excluded.map((entry) => entry.kind)).toEqual(['agent-usage']);
  });

  it('tests a title pattern against the branch as well', () => {
    const result = applyExclusionRules({
      events: [spend('/home/tom/dev/fut-frontend', 'feat/secret-launch')],
      rules: [{ kind: 'title-pattern', pattern: 'secret-launch' }],
    });

    expect(result.kept).toEqual([]);
  });

  it('keeps a turn no rule names, and reports no name in the summary', () => {
    const kept = spend('/home/tom/dev/fut-frontend', 'next');

    const result = applyExclusionRules({ events: [kept], rules: [{ kind: 'title-pattern', pattern: 'invoices' }] });

    expect(result.kept).toEqual([kept]);
  });
});
