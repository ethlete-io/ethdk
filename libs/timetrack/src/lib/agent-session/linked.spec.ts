import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../model/project-link';
import { AgentPromptEvent, AgentSessionEvent, AgentUsageEvent } from '../model/event';
import { keepLinkedAgentSessions, keepPublicAgentRecords } from './linked';

const link = (path: string, target: TimetrackProjectLink['target']): TimetrackProjectLink => ({
  id: path,
  path,
  target,
  createdAt: new Date('2026-08-01T00:00:00Z'),
});

const LINKS = [
  link('/home/tom/dev/fut-frontend', { kind: 'project', projectKey: 'FIP' }),
  link('/home/tom/dev/side', { kind: 'private' }),
];

const session = (cwd: string, at: string): AgentSessionEvent => ({
  source: 'agent-session',
  kind: 'agent-session',
  at: new Date(at),
  sessionId: `${cwd}@${at}`,
  cwd,
});

const spend = (cwd: string, at: string): AgentUsageEvent => ({
  source: 'agent-usage',
  kind: 'agent-usage',
  at: new Date(at),
  provider: 'claude-code',
  sessionId: `${cwd}@${at}`,
  turnId: `msg_${at}`,
  cwd,
  model: 'claude-opus-5',
  usage: { input: 1, output: 10, cacheWrite: 0, cacheRead: 500, thinking: 0 },
});

const typed = (cwd: string, at: string): AgentPromptEvent => ({
  source: 'agent-prompt',
  kind: 'agent-prompt',
  at: new Date(at),
  provider: 'claude-code',
  sessionId: `${cwd}@${at}`,
  promptId: `prompt_${at}`,
  cwd,
});

describe('keepPublicAgentRecords', () => {
  it('keeps a prompt typed in a checkout no link covers, because the day still happened', () => {
    const kept = typed('/home/tom/dev/ethlete-sdk', '2026-09-07T09:57:00Z');

    expect(keepPublicAgentRecords({ events: [kept], links: LINKS })).toEqual([kept]);
  });

  it('keeps a prompt typed in a linked checkout', () => {
    const kept = typed('/home/tom/dev/fut-frontend', '2026-09-07T09:57:00Z');

    expect(keepPublicAgentRecords({ events: [kept], links: LINKS })).toEqual([kept]);
  });

  it('drops a prompt typed in a private checkout', () => {
    const dropped = typed('/home/tom/dev/side/thing', '2026-09-07T09:57:00Z');

    expect(keepPublicAgentRecords({ events: [dropped], links: LINKS })).toEqual([]);
  });

  it('keeps a turn in a checkout no link covers, so it can hold a rebuilt stretch open', () => {
    const kept = spend('/home/tom/dev/ethlete-sdk', '2026-09-07T10:04:00Z');

    expect(keepPublicAgentRecords({ events: [kept], links: LINKS })).toEqual([kept]);
  });

  it('drops a turn in a private checkout', () => {
    const dropped = spend('/home/tom/dev/side/thing', '2026-09-07T10:04:00Z');

    expect(keepPublicAgentRecords({ events: [dropped], links: LINKS })).toEqual([]);
  });
});

describe('keepLinkedAgentSessions', () => {
  it('keeps a session in a checkout a link files into a project', () => {
    const kept = session('/home/tom/dev/fut-frontend', '2026-08-17T09:00:00Z');

    expect(keepLinkedAgentSessions({ events: [kept], links: LINKS }).kept).toEqual([kept]);
  });

  it('keeps a session below the linked directory, not only at it', () => {
    const kept = session('/home/tom/dev/fut-frontend/apps/web', '2026-08-17T09:00:00Z');

    expect(keepLinkedAgentSessions({ events: [kept], links: LINKS }).kept).toEqual([kept]);
  });

  it('drops a private session without reporting it as unlinked, because it has its answer', () => {
    const result = keepLinkedAgentSessions({
      events: [session('/home/tom/dev/side', '2026-08-17T09:00:00Z')],
      links: LINKS,
    });

    expect(result).toEqual({ kept: [], unlinked: [] });
  });

  it('reports an unlinked checkout with its sample count and its last sample', () => {
    const result = keepLinkedAgentSessions({
      events: [
        session('/home/tom/dev/local-ai', '2026-08-17T09:00:00Z'),
        session('/home/tom/dev/local-ai', '2026-08-17T11:00:00Z'),
      ],
      links: LINKS,
    });

    expect(result.kept).toEqual([]);
    expect(result.unlinked).toEqual([
      { cwd: '/home/tom/dev/local-ai', events: 2, lastAt: new Date('2026-08-17T11:00:00Z') },
    ]);
  });

  it('orders the unlinked checkouts by how much they cost, largest first', () => {
    const result = keepLinkedAgentSessions({
      events: [
        session('/home/tom/dev/one', '2026-08-17T09:00:00Z'),
        session('/home/tom/dev/two', '2026-08-17T09:00:00Z'),
        session('/home/tom/dev/two', '2026-08-17T10:00:00Z'),
      ],
      links: LINKS,
    });

    expect(result.unlinked.map((entry) => entry.cwd)).toEqual(['/home/tom/dev/two', '/home/tom/dev/one']);
  });

  it('drops everything when no link exists at all, rather than falling back to keeping it', () => {
    const result = keepLinkedAgentSessions({
      events: [session('/home/tom/dev/fut-frontend', '2026-08-17T09:00:00Z')],
      links: [],
    });

    expect(result.kept).toEqual([]);
    expect(result.unlinked).toHaveLength(1);
  });

  it("filters a turn's spend by the same link, and gives back the same shape", () => {
    const kept = spend('/home/tom/dev/fut-frontend', '2026-08-17T09:00:00Z');
    const dropped = spend('/home/tom/dev/unlinked', '2026-08-17T09:05:00Z');

    const result = keepLinkedAgentSessions({ events: [kept, dropped], links: LINKS });

    expect(result.kept).toEqual([kept]);
    expect(result.unlinked).toEqual([{ cwd: '/home/tom/dev/unlinked', events: 1, lastAt: dropped.at }]);
  });

  it('drops the spend of a checkout a private link covers, the way it drops the session', () => {
    const result = keepLinkedAgentSessions({
      events: [spend('/home/tom/dev/side', '2026-08-17T09:00:00Z')],
      links: LINKS,
    });

    expect(result.kept).toEqual([]);
    expect(result.unlinked).toEqual([]);
  });
});
