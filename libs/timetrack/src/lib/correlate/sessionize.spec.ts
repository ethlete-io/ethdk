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

const session = (minutes: number, cwd: string, gitBranch = 'next'): CollectedEvent => ({
  at: AT(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: `session-${minutes}`,
  cwd,
  gitBranch,
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

  it('follows the editor window that has focus between two checkouts', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        focus(2, 'code', 'list.ts - fut-frontend - Visual Studio Code'),
        checkout(4, 'next', '/home/tom/dev/ethlete-sdk'),
        focus(6, 'code', 'sessionize.ts - ethlete-sdk - Visual Studio Code'),
        focus(10, 'code', 'list.ts - fut-frontend - Visual Studio Code'),
        focus(14, 'code', 'list.ts - fut-frontend - Visual Studio Code'),
      ],
    });

    expect(blocks.map((block) => block.context.repoPath)).toEqual([
      '/home/tom/dev/fut-frontend',
      '/home/tom/dev/ethlete-sdk',
      '/home/tom/dev/fut-frontend',
    ]);
    expect(blocks[2].context.branch).toBe('feat/FIP-2177-user-management');
  });

  it('keeps a repository alive while its window stays focused', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        focus(2, 'code', 'list.ts - fut-frontend - Visual Studio Code'),
        focus(20, 'code', 'list.ts - fut-frontend - Visual Studio Code'),
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].context.repoPath).toBe('/home/tom/dev/fut-frontend');
  });

  it('does not read a repository name buried inside a page title as a switch', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2177-user-management'),
        checkout(4, 'next', '/home/tom/dev/ethlete-sdk'),
        focus(8, 'chrome', 'Why fut-frontend is slow - Stack Overflow'),
      ],
    });

    expect(blocks[blocks.length - 1].context.repoPath).toBe('/home/tom/dev/ethlete-sdk');
  });

  it('refuses to guess which of two repositories a shared directory name means', () => {
    const blocks = sessionize({
      events: [
        checkout(0, 'feat/FIP-2-two', '/home/tom/personal/api'),
        focus(2, 'code', 'server.ts - api - Visual Studio Code'),
        checkout(4, 'feat/FIP-1-one', '/home/tom/work/api'),
        focus(8, 'code', 'server.ts - api - Visual Studio Code'),
      ],
    });

    expect(blocks.map((block) => block.context.repoPath)).toEqual(['/home/tom/personal/api', '/home/tom/work/api']);
  });

  it('folds an agent session started in a subdirectory into its checkout', () => {
    const blocks = sessionize({
      events: [
        session(0, '/home/tom/dev/ethlete-sdk/libs/components'),
        session(3, '/home/tom/dev/ethlete-sdk/apps/timetrack/src-tauri'),
      ],
      options: { repoRoots: ['/home/tom/dev/ethlete-sdk', '/home/tom/dev/ea-frontend'] },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.context.repoPath).toBe('/home/tom/dev/ethlete-sdk');
  });

  it('keeps a directory no known root contains', () => {
    const blocks = sessionize({
      events: [session(0, '/home/tom/scratch'), session(3, '/home/tom/scratch')],
      options: { repoRoots: ['/home/tom/dev/ethlete-sdk'] },
    });

    expect(blocks[0]?.context.repoPath).toBe('/home/tom/scratch');
  });

  /** A checkout inside another one is its own project, so the longest matching root has to win. */
  it('prefers the innermost root when one repository sits inside another', () => {
    const blocks = sessionize({
      events: [session(0, '/home/tom/dev/outer/vendor/inner/src'), session(3, '/home/tom/dev/outer/vendor/inner/src')],
      options: { repoRoots: ['/home/tom/dev/outer', '/home/tom/dev/outer/vendor/inner'] },
    });

    expect(blocks[0]?.context.repoPath).toBe('/home/tom/dev/outer/vendor/inner');
  });

  it('returns nothing for an empty window', () => {
    expect(sessionize({ events: [] })).toEqual([]);
  });
});

describe('sessionize, with editor heartbeats', () => {
  const heartbeat = (
    minutes: number,
    options: { repoPath?: string; branch?: string; directory?: string; editing?: boolean } = {},
  ): CollectedEvent => ({
    at: AT(minutes),
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: 'vscode',
    editing: options.editing ?? true,
    ...options,
  });

  it('names the checkout and the branch a window title could not', () => {
    const inRepo = { repoPath: '/home/tom/dev/fut-frontend', branch: 'feat/FIP-2177-user-management' };
    const blocks = sessionize({
      events: [
        focus(0, 'code', 'Visual Studio Code'),
        heartbeat(1, inRepo),
        heartbeat(10, inRepo),
        heartbeat(20, inRepo),
      ],
    });

    expect(blocks.at(-1)?.context.repoPath).toBe('/home/tom/dev/fut-frontend');
    expect(blocks.at(-1)?.context.branch).toBe('feat/FIP-2177-user-management');
  });

  it('folds a workspace opened below the checkout into its root', () => {
    const blocks = sessionize({
      events: [
        heartbeat(0, { repoPath: '/home/tom/dev/ethlete-sdk/libs/components' }),
        heartbeat(3, { repoPath: '/home/tom/dev/ethlete-sdk/apps/timetrack' }),
      ],
      options: { repoRoots: ['/home/tom/dev/ethlete-sdk'] },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.context.repoPath).toBe('/home/tom/dev/ethlete-sdk');
  });

  it('splits where the editor moved to another checkout', () => {
    const blocks = sessionize({
      events: [
        heartbeat(0, { repoPath: '/home/tom/dev/fut-frontend' }),
        heartbeat(3, { repoPath: '/home/tom/dev/fut-frontend' }),
        heartbeat(6, { repoPath: '/home/tom/dev/ethlete-sdk' }),
        heartbeat(9, { repoPath: '/home/tom/dev/ethlete-sdk' }),
      ],
    });

    expect(blocks.map((block) => block.context.repoPath)).toEqual([
      '/home/tom/dev/fut-frontend',
      '/home/tom/dev/ethlete-sdk',
    ]);
  });

  it('keeps one evidence entry per directory rather than one per heartbeat', () => {
    const blocks = sessionize({
      events: [
        heartbeat(0, { repoPath: '/home/tom/dev/ethlete-sdk', directory: 'libs/components/src/lib/table' }),
        heartbeat(3, { repoPath: '/home/tom/dev/ethlete-sdk', directory: 'libs/components/src/lib/table' }),
        heartbeat(6, { repoPath: '/home/tom/dev/ethlete-sdk', directory: 'libs/components/src/lib/table' }),
      ],
    });

    expect(blocks[0]?.evidence).toEqual([
      { kind: 'editor', at: AT(0), detail: 'edited libs/components/src/lib/table' },
    ]);
  });

  it('reports a heartbeat that only read the file as reading it', () => {
    const blocks = sessionize({
      events: [
        heartbeat(0, { repoPath: '/home/tom/dev/ethlete-sdk', directory: 'libs/core', editing: false }),
        heartbeat(3, { repoPath: '/home/tom/dev/ethlete-sdk', directory: 'libs/core', editing: false }),
      ],
    });

    expect(blocks[0]?.evidence[0]?.detail).toBe('read libs/core');
  });

  /**
   * A heartbeat with no checkout is still presence — it observes that the machine was worked on — but
   * it must not clear the repository the block already has.
   */
  it('does not drop the repository for a heartbeat outside any checkout', () => {
    const blocks = sessionize({
      events: [
        heartbeat(0, { repoPath: '/home/tom/dev/ethlete-sdk' }),
        heartbeat(3, { directory: '/home/tom/notes' }),
        heartbeat(6, { repoPath: '/home/tom/dev/ethlete-sdk' }),
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.context.repoPath).toBe('/home/tom/dev/ethlete-sdk');
  });
});
