import { describe, expect, it } from 'vitest';
import {
  AgentPromptEvent,
  AgentUsageEvent,
  CalendarOccurrenceEvent,
  CollectedEvent,
  EditorHeartbeatEvent,
  GitCheckoutEvent,
  GitCommitEvent,
} from '../model/event';
import { dedupeKeyOf } from './dedupe';

const commit = (overrides: Partial<GitCommitEvent> = {}): GitCommitEvent => ({
  at: new Date(2026, 7, 11, 11, 30),
  source: 'git',
  kind: 'git-commit',
  repoPath: '/home/tom/dev/fut-frontend',
  branch: 'feat/FIP-2177-user-management',
  sha: 'abc1234',
  subject: 'feat(user): Add the invite flow',
  ...overrides,
});

const checkout = (overrides: Partial<GitCheckoutEvent> = {}): GitCheckoutEvent => ({
  at: new Date(2026, 7, 11, 9, 15),
  source: 'git',
  kind: 'git-checkout',
  repoPath: '/home/tom/dev/fut-frontend',
  branch: 'feat/FIP-2177-user-management',
  ...overrides,
});

const meeting = (overrides: Partial<CalendarOccurrenceEvent> = {}): CalendarOccurrenceEvent => ({
  at: new Date(2026, 7, 11, 10, 0),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: 'evt1_20260811T080000Z',
  until: new Date(2026, 7, 11, 11, 0),
  title: 'Sprint Planning',
  accepted: true,
  ...overrides,
});

describe('dedupeKeyOf', () => {
  it('keys a commit the same way on every rescan', () => {
    expect(dedupeKeyOf(commit())).toBe(dedupeKeyOf(commit()));
  });

  it('keys a commit by its sha, so the branch the first scan reported stays', () => {
    expect(dedupeKeyOf(commit({ branch: 'next' }))).toBe(dedupeKeyOf(commit()));
  });

  it('separates the same sha in two repositories', () => {
    expect(dedupeKeyOf(commit({ repoPath: '/home/tom/dev/ethlete-sdk' }))).not.toBe(dedupeKeyOf(commit()));
  });

  it('separates two commits in one repository', () => {
    expect(dedupeKeyOf(commit({ sha: 'def5678' }))).not.toBe(dedupeKeyOf(commit()));
  });

  it('keys a checkout by the instant HEAD moved and where it moved to', () => {
    expect(dedupeKeyOf(checkout())).toBe(dedupeKeyOf(checkout()));
    expect(dedupeKeyOf(checkout({ branch: 'next' }))).not.toBe(dedupeKeyOf(checkout()));
    expect(dedupeKeyOf(checkout({ at: new Date(2026, 7, 11, 9, 16) }))).not.toBe(dedupeKeyOf(checkout()));
  });

  it('keys the same occurrence the same way on every overlapping read', () => {
    expect(dedupeKeyOf(meeting())).toBe(dedupeKeyOf(meeting()));
    expect(dedupeKeyOf(meeting({ title: 'Sprint Planning (moved room)' }))).toBe(dedupeKeyOf(meeting()));
  });

  it('keys a meeting somebody moved as a new occurrence, not as the one it used to be', () => {
    expect(dedupeKeyOf(meeting({ at: new Date(2026, 7, 11, 14, 0) }))).not.toBe(dedupeKeyOf(meeting()));
    expect(dedupeKeyOf(meeting({ until: new Date(2026, 7, 11, 12, 0) }))).not.toBe(dedupeKeyOf(meeting()));
  });

  it('separates two occurrences of one series', () => {
    expect(dedupeKeyOf(meeting({ occurrenceId: 'evt1_20260812T080000Z' }))).not.toBe(dedupeKeyOf(meeting()));
  });

  it('never keys a commit and a checkout alike', () => {
    expect(dedupeKeyOf(checkout())).not.toBe(dedupeKeyOf(commit()));
  });

  it('leaves an observation only its collector could have made unkeyed', () => {
    const focus: CollectedEvent = {
      at: new Date(2026, 7, 11, 9, 30),
      source: 'window',
      kind: 'window-focus',
      appId: 'code',
      title: 'dedupe.ts - ethlete-sdk',
    };

    expect(dedupeKeyOf(focus)).toBeNull();
    expect(dedupeKeyOf({ at: new Date(), source: 'idle', kind: 'idle-start' })).toBeNull();
  });

  it('keys a heartbeat by its reporter and its instant, so a retry stores it once', () => {
    const heartbeat = (overrides: Partial<EditorHeartbeatEvent> = {}): EditorHeartbeatEvent => ({
      at: new Date(2026, 7, 11, 9, 30),
      source: 'editor',
      kind: 'editor-heartbeat',
      reporter: 'vscode',
      repoPath: '/home/tom/dev/fut-frontend',
      directory: 'src/app',
      editing: true,
      ...overrides,
    });

    expect(dedupeKeyOf(heartbeat({ directory: 'src/lib' }))).toBe(dedupeKeyOf(heartbeat()));
    expect(dedupeKeyOf(heartbeat({ at: new Date(2026, 7, 11, 9, 31) }))).not.toBe(dedupeKeyOf(heartbeat()));
    expect(dedupeKeyOf(heartbeat({ reporter: 'chrome' }))).not.toBe(dedupeKeyOf(heartbeat()));
  });

  it('keys a turn by its provider and its own id, so a log read again adds no spend', () => {
    const spend = (overrides: Partial<AgentUsageEvent> = {}): AgentUsageEvent => ({
      at: new Date(2026, 7, 11, 9, 30),
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: 'claude-code',
      sessionId: '154009aa-3442-401d-852b-07a0d5156e97',
      turnId: 'msg_011Ceqk1wsbtNyCbzz8e9kGB',
      cwd: '/home/tom/dev/fut-frontend',
      gitBranch: 'feat/FIP-2177-user-management',
      model: 'claude-opus-5',
      usage: { input: 2, output: 289, cacheWrite: 17_421, cacheRead: 18_910, thinking: 0 },
      ...overrides,
    });

    expect(dedupeKeyOf(spend({ at: new Date(2026, 7, 11, 9, 31) }))).toBe(dedupeKeyOf(spend()));
    expect(dedupeKeyOf(spend({ turnId: 'msg_other' }))).not.toBe(dedupeKeyOf(spend()));
    expect(dedupeKeyOf(spend({ provider: 'codex' }))).not.toBe(dedupeKeyOf(spend()));
  });

  it('keys a prompt by its provider and the record id, so a log read again adds no keystroke', () => {
    const prompt = (overrides: Partial<AgentPromptEvent> = {}): AgentPromptEvent => ({
      at: new Date(2026, 8, 7, 9, 57),
      source: 'agent-prompt',
      kind: 'agent-prompt',
      provider: 'claude-code',
      sessionId: '154009aa-3442-401d-852b-07a0d5156e97',
      promptId: '7afab4fa-fa08-475b-b9c0-23ba6a62ceb2',
      cwd: '/home/tom/dev/fut-frontend',
      ...overrides,
    });

    expect(dedupeKeyOf(prompt({ at: new Date(2026, 8, 7, 9, 58) }))).toBe(dedupeKeyOf(prompt()));
    expect(dedupeKeyOf(prompt({ promptId: 'other' }))).not.toBe(dedupeKeyOf(prompt()));
    expect(dedupeKeyOf(prompt({ provider: 'codex' }))).not.toBe(dedupeKeyOf(prompt()));
  });
});
