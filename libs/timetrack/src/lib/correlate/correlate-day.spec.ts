import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { correlateDay } from './correlate-day';

const MINUTE = 60_000;
const AT = (minute: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minute * MINUTE);
const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
const REPO = '/home/tom/dev/fut-frontend';

const focus = (minute: number, appId: string, title = appId): CollectedEvent => ({
  at: AT(minute),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const checkout = (minute: number, branch: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-checkout',
  repoPath: REPO,
  branch,
});

const commit = (minute: number, sha: string, subject: string, branch: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-commit',
  repoPath: REPO,
  branch,
  sha,
  subject,
});

const presence = (minute: number, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
  at: AT(minute),
  source: 'idle',
  kind,
});

const STORY = 'feat/FIP-2177-user-management';

const DAY: CollectedEvent[] = [
  checkout(0, STORY),
  focus(1, 'code'),
  commit(20, 'a1b2c3d', 'feat(user): Add the invite form', STORY),
  commit(45, 'e4f5g6h', 'fix(user): Trim the invite email', STORY),
  focus(50, 'chrome', '[FIP-2222] Button not visible - Jira'),
  presence(60, 'idle-start'),
  presence(90, 'idle-end'),
  checkout(90, 'fix/logout-confirmation'),
  commit(110, 'i7j8k9l', 'fix(auth): Confirm before logout', 'fix/logout-confirmation'),
  presence(120, 'idle-start'),
];

describe('correlateDay', () => {
  it('reconstructs a day of worklogs from raw events', () => {
    const day = correlateDay({ events: DAY, config: FIP, resolveBase: () => STORY });

    expect(day.blocks).toHaveLength(2);
    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-2177', 'FIP-2177']);
    expect(day.proposals.map((proposal) => proposal.durationMs / MINUTE)).toEqual([60, 30]);
    expect(day.unattributed).toEqual([]);
  });

  it('describes each row from the commits inside it', () => {
    const day = correlateDay({ events: DAY, config: FIP, resolveBase: () => STORY });

    expect(day.proposals[0]?.description).toBe('feat(user): Add the invite form; fix(user): Trim the invite email');
    expect(day.proposals[1]?.description).toBe('fix(auth): Confirm before logout');
  });

  it('keeps the same issue in two rows when a break separates them', () => {
    const day = correlateDay({ events: DAY, config: FIP, resolveBase: () => STORY });

    expect(day.proposals[0]?.to).toEqual(AT(60));
    expect(day.proposals[1]?.from).toEqual(AT(90));
  });

  it('rates a conforming branch above one that only inherited its key', () => {
    const day = correlateDay({ events: DAY, config: FIP, resolveBase: () => STORY });

    expect(day.proposals.map((proposal) => proposal.confidence)).toEqual(['certain', 'likely']);
  });

  it('compares the day to a target without filling it', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      check: { targetMs: 480 * MINUTE },
    });

    expect(day.check.proposedMs).toBe(90 * MINUTE);
    expect(day.check.deltaMs).toBe(-390 * MINUTE);
    expect(day.check.warnings.map((warning) => warning.kind)).toEqual(['under-target']);
  });

  it('leaves a keyless branch unattributed when nothing resolves its base', () => {
    const day = correlateDay({ events: DAY, config: FIP });

    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-2177']);
    expect(day.unattributed).toHaveLength(1);
    expect(day.check.unattributedMs).toBe(30 * MINUTE);
    expect(day.check.warnings.map((warning) => warning.kind)).toContain('unattributed-time');
  });

  it('proposes nothing for an empty window', () => {
    const day = correlateDay({ events: [], config: FIP });

    expect(day).toMatchObject({ blocks: [], proposals: [], unattributed: [] });
    expect(day.check.proposedMs).toBe(0);
    expect(day.check.warnings).toEqual([]);
  });
});
