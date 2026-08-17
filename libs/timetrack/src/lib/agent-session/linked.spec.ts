import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../correlate/project-link';
import { AgentSessionEvent } from '../model/event';
import { keepLinkedAgentSessions } from './linked';

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
});
