import { describe, expect, it } from 'vitest';
import { blockDurationMs } from '../model/block';
import { CollectedEvent } from '../model/event';
import { sessionize } from './sessionize';

const AT = (minutes: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minutes * 60_000);

const focus = (minutes: number, appId: string, title = appId): CollectedEvent => ({
  at: AT(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const checkout = (minutes: number, branch: string, repoPath = '/home/tom/dev/fut-frontend'): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-checkout',
  repoPath,
  branch,
});

const commit = (minutes: number, sha: string, subject: string, branch: string): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath: '/home/tom/dev/fut-frontend',
  branch,
  sha,
  subject,
});

const presence = (minutes: number, kind: 'idle-start' | 'idle-end' | 'lock' | 'unlock'): CollectedEvent => ({
  at: AT(minutes),
  source: 'idle',
  kind,
});

describe('sessionize', () => {
  it('runs one block while the context holds', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        focus(1, 'code'),
        commit(20, 'abc1234', 'feat(hub): Add the list view', 'feat/FIP-2177-user-management'),
        commit(40, 'def5678', 'fix(hub): Correct the empty state', 'feat/FIP-2177-user-management'),
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].context.branch).toBe('feat/FIP-2177-user-management');
    expect(blockDurationMs(blocks[0])).toBe(40 * 60_000);
  });

  it('splits on an explicit idle and starts a fresh block on return', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        commit(10, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
        presence(11, 'idle-start'),
        presence(70, 'idle-end'),
        commit(71, 'def5678', 'feat(hub): Two', 'feat/FIP-2177-user-management'),
        commit(90, 'aaa1111', 'feat(hub): Three', 'feat/FIP-2177-user-management'),
      ],
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].to).toEqual(AT(11));
    expect(blocks[1].from).toEqual(AT(71));
  });

  it('ends a block at its last sample when the samples simply stop', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        commit(10, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
        checkout(200, 'feat/FIP-2902-hub-game-codes-list-view'),
        commit(210, 'def5678', 'feat(hub): Two', 'feat/FIP-2902-hub-game-codes-list-view'),
      ],
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].to).toEqual(AT(10));
  });

  it('absorbs a sub-minute alt-tab instead of splitting the block', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        commit(10, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
        focus(10.1, 'slack'),
        commit(10.5, 'def5678', 'feat(hub): Two', 'feat/FIP-2177-user-management'),
        commit(30, 'aaa1111', 'feat(hub): Three', 'feat/FIP-2177-user-management'),
      ],
      options: { repoStickinessMs: 0 },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].context.branch).toBe('feat/FIP-2177-user-management');
    expect(blockDurationMs(blocks[0])).toBe(30 * 60_000);
  });

  it('keeps repo context across a focus change until stickiness runs out', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        focus(1, 'code'),
        focus(2, 'chrome', 'FIP-2177 user management - Jira'),
        commit(3, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
        commit(30, 'def5678', 'feat(hub): Two', 'feat/FIP-2177-user-management'),
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].context.repoPath).toBe('/home/tom/dev/fut-frontend');
  });

  it('deduplicates repeated window titles but keeps every commit', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        focus(1, 'code', 'table.ts - fut-frontend'),
        focus(2, 'code', 'table.ts - fut-frontend'),
        commit(10, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
        commit(20, 'def5678', 'feat(hub): Two', 'feat/FIP-2177-user-management'),
      ],
    });

    const titles = blocks[0].evidence.filter((entry) => entry.kind === 'window-title');
    const commits = blocks[0].evidence.filter((entry) => entry.kind === 'commit');

    expect(titles).toHaveLength(1);
    expect(commits).toHaveLength(2);
  });

  it('clips to working hours and drops what falls outside', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        commit(600, 'abc1234', 'feat(hub): One', 'feat/FIP-2177-user-management'),
      ],
      options: { maxUnobservedMs: 24 * 60 * 60_000, workingHours: { startMinute: 9 * 60, endMinute: 17 * 60 } },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].from.getHours()).toBeGreaterThanOrEqual(9);
    expect(blocks[0].to.getHours()).toBeLessThanOrEqual(17);
  });

  it('returns nothing for an empty window', () => {
    expect(sessionize({ events: [] })).toEqual([]);
  });
});
