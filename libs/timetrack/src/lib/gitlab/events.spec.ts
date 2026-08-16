import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { GitLabCredentials } from './client';
import { fetchGitLabEvents$ } from './events';

const CREDENTIALS: GitLabCredentials = { host: 'git.example.com', token: 'glpat-secret' };

const eventTransport = (pages: { body: unknown[]; nextPage?: string }[]) => {
  const requests: TimetrackRequest[] = [];
  let page = 0;
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);
      const current = pages[page] ?? { body: [] };
      page += 1;

      return of({
        status: 200,
        headers: { 'X-Next-Page': current.nextPage ?? '' },
        body: current.body,
      }) as never;
    }),
  };

  return { transport, requests };
};

const events = (transport: TimetrackTransport) => {
  const seen = vi.fn();

  fetchGitLabEvents$({
    transport,
    credentials: CREDENTIALS,
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
  }).subscribe(seen);

  return seen.mock.calls[0]?.[0] ?? [];
};

const APPROVAL = {
  id: 9001,
  created_at: '2026-08-11T09:15:00.000+02:00',
  action_name: 'approved',
  project_id: 42,
  target_type: 'MergeRequest',
  target_iid: 412,
  target_title: 'Club pack',
};

const NOTE = {
  id: 9002,
  created_at: '2026-08-11T09:20:00.000+02:00',
  action_name: 'commented on',
  project_id: 42,
  target_type: 'Note',
  note: { noteable_type: 'MergeRequest', noteable_iid: 412, body: 'looks good' },
};

describe('fetchGitLabEvents$', () => {
  it('asks the instance for the window with a day of slack at each end', () => {
    const { transport, requests } = eventTransport([{ body: [] }]);

    events(transport);

    expect(requests[0]?.url).toContain('https://git.example.com/api/v4/events');
    expect(requests[0]?.url).toContain('after=2026-08-10');
    expect(requests[0]?.url).toContain('before=2026-08-12');
    expect(requests[0]?.headers?.['private-token']).toBe('glpat-secret');
  });

  it('reads the merge request a note was left on, which the event names only through the note', () => {
    const { transport } = eventTransport([{ body: [APPROVAL, NOTE] }]);
    const read = events(transport);

    expect(read.map((event: { mergeRequestIid?: string }) => event.mergeRequestIid)).toEqual(['412', '412']);
    expect(read[0]).toMatchObject({ id: '9001', action: 'approved', projectId: '42', title: 'Club pack' });
  });

  it('takes the branch straight off a push, which is the one event that carries it', () => {
    const { transport } = eventTransport([
      {
        body: [
          {
            id: 9003,
            created_at: '2026-08-11T10:00:00.000+02:00',
            action_name: 'pushed to',
            project_id: 42,
            push_data: { ref: 'sub/feat/FIP-2177-x/FIP-2178-y', ref_type: 'branch', commit_title: 'Add the thing' },
          },
        ],
      },
    ]);

    expect(events(transport)[0]).toMatchObject({
      branch: 'sub/feat/FIP-2177-x/FIP-2178-y',
      title: 'Add the thing',
    });
  });

  it('drops what fell outside the window the wider query brought back', () => {
    const { transport } = eventTransport([
      { body: [{ ...APPROVAL, id: 1, created_at: '2026-08-10T22:00:00.000+02:00' }, APPROVAL] },
    ]);

    expect(events(transport).map((event: { id: string }) => event.id)).toEqual(['9001']);
  });

  it('follows the next page the header names, and stops when it comes back empty', () => {
    const { transport, requests } = eventTransport([
      { body: [APPROVAL], nextPage: '2' },
      { body: [NOTE], nextPage: '' },
    ]);

    expect(events(transport)).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.url).toContain('page=2');
  });

  it('ignores an event with no id, no project or no readable instant', () => {
    const { transport } = eventTransport([
      {
        body: [
          { ...APPROVAL, id: undefined },
          { ...APPROVAL, created_at: 'not a date' },
        ],
      },
    ]);

    expect(events(transport)).toEqual([]);
  });
});
