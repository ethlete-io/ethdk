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

const calendar = (options: { minute: number; minutes: number; title: string; accepted?: boolean }): CollectedEvent => ({
  at: AT(options.minute),
  source: 'calendar',
  kind: 'calendar-event',
  until: AT(options.minute + options.minutes),
  title: options.title,
  accepted: options.accepted ?? true,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
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

/** One ticket all morning, twice interrupted by a pause too short to be a break. */
const THINKING_DAY: CollectedEvent[] = [
  checkout(0, STORY),
  focus(1, 'code'),
  commit(20, 'a1b2c3d', 'feat(user): Add the invite form', STORY),
  presence(30, 'idle-start'),
  presence(42, 'idle-end'),
  checkout(42, STORY),
  commit(50, 'e4f5g6h', 'fix(user): Trim the invite email', STORY),
  presence(60, 'idle-start'),
  presence(72, 'idle-end'),
  checkout(72, STORY),
  commit(80, 'i7j8k9l', 'fix(user): Sort the invite list', STORY),
  presence(90, 'idle-start'),
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

  it('joins short idle gaps to the work before them, as one row', () => {
    const day = correlateDay({ events: THINKING_DAY, config: FIP });

    expect(day.filledMs).toBe(24 * MINUTE);
    expect(day.proposals).toHaveLength(1);
    expect(day.proposals[0]?.durationMs / MINUTE).toBe(90);
    expect(day.proposals[0]?.evidence.some((entry) => entry.kind === 'gap-fill')).toBe(true);
  });

  it('reports filled time rather than hiding it in the total', () => {
    const day = correlateDay({ events: THINKING_DAY, config: FIP });

    expect(day.check.warnings.map((warning) => warning.kind)).toContain('filled-time');
  });

  it('fills nothing when the threshold is zero', () => {
    const day = correlateDay({ events: THINKING_DAY, config: FIP, fill: { maxFillGapMs: 0 } });

    expect(day.filledMs).toBe(0);
    expect(day.proposals[0]?.durationMs / MINUTE).toBe(60);
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

  it('places a meeting in the day as its own row, in clock order', () => {
    const day = correlateDay({
      events: [...DAY, calendar({ minute: 150, minutes: 60, title: 'FIP-2222 refinement' })],
      config: FIP,
      resolveBase: () => STORY,
    });

    expect(day.meetings).toHaveLength(1);
    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-2177', 'FIP-2177', 'FIP-2222']);
    expect(day.proposals[2]?.description).toBe('FIP-2222 refinement');
    expect(day.proposals[2]?.durationMs).toBe(60 * MINUTE);
  });

  it('warns when a meeting and observed activity claim the same time', () => {
    const day = correlateDay({
      events: [...DAY, calendar({ minute: 0, minutes: 60, title: 'FIP-2222 refinement' })],
      config: FIP,
      resolveBase: () => STORY,
    });

    expect(day.meetings[0]?.overlapMs).toBe(60 * MINUTE);
    expect(day.check.warnings.map((warning) => warning.kind)).toContain('meeting-overlap');
  });

  it('leaves a meeting no rule can name in the unattributed groups', () => {
    const day = correlateDay({
      events: [...DAY, calendar({ minute: 150, minutes: 30, title: 'Braune Digital Weekly' })],
      config: FIP,
      resolveBase: () => STORY,
    });

    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-2177', 'FIP-2177']);
    expect(day.unattributed.map((group) => group.evidence[0]?.summary)).toEqual(['Braune Digital Weekly']);
  });

  it('lets a timer run displace the reconstruction underneath it', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      timerRuns: [{ id: 'run-1', from: AT(0), to: AT(60), issueKey: 'FIP-3000' }],
    });

    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-3000', 'FIP-2177']);
    expect(day.proposals.map((proposal) => proposal.durationMs / MINUTE)).toEqual([60, 30]);
    expect(day.check.proposedMs).toBe(90 * MINUTE);
  });

  it('splits a block a timer run falls inside of rather than dropping it', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      timerRuns: [{ id: 'run-1', from: AT(20), to: AT(40), issueKey: 'FIP-3000' }],
    });

    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual([
      'FIP-2177',
      'FIP-3000',
      'FIP-2177',
      'FIP-2177',
    ]);
    expect(day.check.proposedMs).toBe(90 * MINUTE);
  });

  it('warns about a timer that ran with nothing observed inside it', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      timerRuns: [{ id: 'run-1', from: AT(300), to: AT(420), issueKey: 'FIP-3000' }],
    });

    expect(day.timers[0]?.observedMs).toBe(0);
    expect(day.check.warnings.map((warning) => warning.kind)).toContain('timer-unobserved');
  });

  it('leaves a run nobody named in the unattributed groups', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      timerRuns: [{ id: 'run-1', from: AT(300), to: AT(360) }],
    });

    expect(day.proposals.map((proposal) => proposal.issueKey)).toEqual(['FIP-2177', 'FIP-2177']);
    expect(day.unattributed.map((group) => group.observedMs / MINUTE)).toEqual([60]);
  });

  it('cuts a pause out of the block that would otherwise bridge it', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      pauses: [{ from: AT(20), to: AT(40) }],
    });

    expect(day.pausedMs).toBe(20 * MINUTE);
    expect(day.check.proposedMs).toBeLessThan(
      correlateDay({ events: DAY, config: FIP, resolveBase: () => STORY }).check.proposedMs,
    );
  });

  it('never fills a gap a pause reaches into', () => {
    const day = correlateDay({ events: THINKING_DAY, config: FIP, pauses: [{ from: AT(30), to: AT(42) }] });

    expect(day.filledMs).toBe(12 * MINUTE);
  });

  it('reports paused time, so a short day says why it is short', () => {
    const day = correlateDay({
      events: DAY,
      config: FIP,
      resolveBase: () => STORY,
      pauses: [{ from: AT(20), to: AT(40) }],
    });

    expect(day.check.warnings.map((warning) => warning.kind)).toContain('paused-time');
  });

  it('proposes nothing for an empty window', () => {
    const day = correlateDay({ events: [], config: FIP });

    expect(day).toMatchObject({ blocks: [], proposals: [], unattributed: [] });
    expect(day.check.proposedMs).toBe(0);
    expect(day.check.warnings).toEqual([]);
  });
});
