import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../correlate/project-link';
import { AgentSessionCursor } from './collect';
import { UnlinkedAgentSessions } from './linked';
import { agentSessionResyncOffers, resyncAgentSessionCursors } from './resync';

const cursor = (id: string, cwd?: string): AgentSessionCursor => ({
  id,
  nextLine: 120,
  after: new Date('2026-08-17T09:00:00Z'),
  title: 'a session',
  ...(cwd === undefined ? {} : { cwd }),
});

const rewound = (cursors: AgentSessionCursor[], paths: string[]) =>
  resyncAgentSessionCursors({ cursors, paths })
    .filter((entry) => entry.nextLine === 0)
    .map((entry) => entry.id);

describe('resyncAgentSessionCursors', () => {
  it('rewinds a cursor whose checkout the path names', () => {
    const result = resyncAgentSessionCursors({
      cursors: [cursor('a', '/home/tom/dev/fut-frontend')],
      paths: ['/home/tom/dev/fut-frontend'],
    });

    expect(result).toEqual([{ id: 'a', nextLine: 0, cwd: '/home/tom/dev/fut-frontend' }]);
  });

  it('clears the last sample and the title, so the re-read starts as a first read would', () => {
    const [reset] = resyncAgentSessionCursors({
      cursors: [cursor('a', '/home/tom/dev/fut-frontend')],
      paths: ['/home/tom/dev/fut-frontend'],
    });

    expect(reset?.after).toBeUndefined();
    expect(reset?.title).toBeUndefined();
  });

  it('rewinds a cursor below a directory the path names', () => {
    expect(rewound([cursor('a', '/home/tom/dev/fut-frontend/apps/web')], ['/home/tom/dev'])).toEqual(['a']);
  });

  it('leaves a cursor in a sibling directory alone, because a re-read would double its samples', () => {
    expect(rewound([cursor('a', '/home/tom/dev-old/fut-frontend')], ['/home/tom/dev'])).toEqual([]);
  });

  it('leaves a cursor written before the checkout was recorded alone', () => {
    expect(rewound([cursor('a')], ['/home/tom/dev/fut-frontend'])).toEqual([]);
  });

  it('rewinds nothing when no path is given', () => {
    expect(rewound([cursor('a', '/home/tom/dev')], [])).toEqual([]);
  });

  it('ignores an empty path rather than reading it as every checkout', () => {
    expect(rewound([cursor('a', '/home/tom/dev')], ['', '  '])).toEqual([]);
  });

  it('keeps the cursors it did not rewind exactly as they were', () => {
    const kept = cursor('b', '/home/tom/dev/other');
    const result = resyncAgentSessionCursors({
      cursors: [cursor('a', '/home/tom/dev/fut-frontend'), kept],
      paths: ['/home/tom/dev/fut-frontend'],
    });

    expect(result[1]).toBe(kept);
  });

  it('rewinds every cursor a path covers, not only the first', () => {
    const cursors = [
      cursor('a', '/home/tom/dev/fut-frontend'),
      cursor('b', '/home/tom/dev/fut-frontend/apps/web'),
      cursor('c', '/home/tom/dev/other'),
    ];

    expect(rewound(cursors, ['/home/tom/dev/fut-frontend'])).toEqual(['a', 'b']);
  });
});

const link = (path: string, target: TimetrackProjectLink['target']): TimetrackProjectLink => ({
  id: path,
  path,
  target,
  createdAt: new Date('2026-08-01T00:00:00Z'),
});

const skipped = (cwd: string, events = 3): UnlinkedAgentSessions => ({
  cwd,
  events,
  lastAt: new Date('2026-08-17T11:00:00Z'),
});

describe('agentSessionResyncOffers', () => {
  it('offers a skipped checkout a link now files into a project', () => {
    const entry = skipped('/home/tom/dev/fut-frontend');
    const result = agentSessionResyncOffers({
      unlinked: [entry],
      links: [link('/home/tom/dev/fut-frontend', { kind: 'project', projectKey: 'FIP' })],
    });

    expect(result).toEqual([{ ...entry, projectKey: 'FIP' }]);
  });

  it('offers a checkout a linked directory above it covers', () => {
    const result = agentSessionResyncOffers({
      unlinked: [skipped('/home/tom/dev/fut-frontend/apps/web')],
      links: [link('/home/tom/dev', { kind: 'project', projectKey: 'FIP' })],
    });

    expect(result.map((offer) => offer.projectKey)).toEqual(['FIP']);
  });

  it('offers nothing for a checkout still covered by no link', () => {
    expect(agentSessionResyncOffers({ unlinked: [skipped('/home/tom/dev/local-ai')], links: [] })).toEqual([]);
  });

  it('offers nothing for a checkout the user marked private, because a re-read would drop it again', () => {
    const result = agentSessionResyncOffers({
      unlinked: [skipped('/home/tom/dev/side')],
      links: [link('/home/tom/dev/side', { kind: 'private' })],
    });

    expect(result).toEqual([]);
  });

  it('keeps the order it was given, which is the costliest checkout first', () => {
    const result = agentSessionResyncOffers({
      unlinked: [skipped('/home/tom/dev/two', 9), skipped('/home/tom/dev/one', 2)],
      links: [link('/home/tom/dev', { kind: 'project', projectKey: 'FIP' })],
    });

    expect(result.map((offer) => offer.cwd)).toEqual(['/home/tom/dev/two', '/home/tom/dev/one']);
  });
});
