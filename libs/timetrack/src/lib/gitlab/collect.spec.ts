import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MergeRequestActivityEvent } from '../model/event';
import { dedupeKeyOf } from '../store/dedupe';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { GitLabCredentials } from './client';
import { GitLabCollection, collectGitLabEvents$ } from './collect';

const CREDENTIALS: GitLabCredentials = { host: 'git.example.com', token: 'glpat-secret' };

const NOTE = {
  id: 9002,
  created_at: '2026-08-11T09:20:00.000+02:00',
  action_name: 'commented on',
  project_id: 42,
  target_type: 'Note',
  note: { noteable_type: 'MergeRequest', noteable_iid: 412 },
};

const MERGE_REQUEST = {
  iid: 412,
  project_id: 42,
  title: 'Password reset',
  source_branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
  web_url: 'https://git.example.com/braune-digital/app/-/merge_requests/412',
  references: { full: 'braune-digital/app!412' },
};

const stubTransport = (options: { events: unknown[]; mergeRequest?: unknown; mergeRequestStatus?: number }) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.url.includes('/merge_requests/')) {
        return of({
          status: options.mergeRequestStatus ?? 200,
          headers: {},
          body: options.mergeRequest ?? MERGE_REQUEST,
        }) as never;
      }

      return of({ status: 200, headers: { 'x-next-page': '' }, body: options.events }) as never;
    }),
  };

  return { transport, requests };
};

const collect = (transport: TimetrackTransport, options: { maxMergeRequestLookups?: number } = {}) => {
  const seen = vi.fn();

  collectGitLabEvents$({
    transport,
    credentials: CREDENTIALS,
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
    maxMergeRequestLookups: options.maxMergeRequestLookups,
  }).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? { events: [], failures: [] }) as GitLabCollection;
};

describe('collectGitLabEvents$', () => {
  it('gives a note event the branch its merge request is on', () => {
    const { transport } = stubTransport({ events: [NOTE] });
    const [event] = collect(transport).events as MergeRequestActivityEvent[];

    expect(event).toMatchObject({
      source: 'gitlab',
      kind: 'merge-request-activity',
      eventId: '9002',
      action: 'commented on',
      mergeRequestIid: '412',
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      projectPath: 'braune-digital/app',
    });
  });

  it('reads one merge request however many events were left on it', () => {
    const { transport, requests } = stubTransport({ events: [NOTE, { ...NOTE, id: 9003 }] });
    const collection = collect(transport);

    expect(collection.events).toHaveLength(2);
    expect(requests.filter((request) => request.url.includes('/merge_requests/'))).toHaveLength(1);
  });

  it('never looks up a push, which already said which branch it moved', () => {
    const { transport, requests } = stubTransport({
      events: [
        {
          id: 9004,
          created_at: '2026-08-11T10:00:00.000+02:00',
          action_name: 'pushed to',
          project_id: 42,
          target_type: 'MergeRequest',
          target_iid: 412,
          push_data: { ref: 'feat/FIP-2177-user-management', ref_type: 'branch' },
        },
      ],
    });
    const collection = collect(transport);

    expect(requests.filter((request) => request.url.includes('/merge_requests/'))).toEqual([]);
    expect((collection.events[0] as MergeRequestActivityEvent).branch).toBe('feat/FIP-2177-user-management');
  });

  it('keeps an event whose merge request the token cannot read, and reports why', () => {
    const { transport } = stubTransport({ events: [NOTE], mergeRequestStatus: 404 });
    const collection = collect(transport);

    expect(collection.events).toHaveLength(1);
    expect((collection.events[0] as MergeRequestActivityEvent).branch).toBeUndefined();
    expect(collection.failures[0]).toContain('merge request !412');
  });

  it('drops activity that was about no merge request at all', () => {
    const { transport } = stubTransport({
      events: [
        { id: 1, created_at: '2026-08-11T09:00:00.000+02:00', action_name: 'joined', project_id: 42 },
        { ...NOTE, note: { noteable_type: 'Issue', noteable_iid: 7 } },
      ],
    });

    expect(collect(transport).events).toEqual([]);
  });

  it('reports the merge requests a run did not read rather than dropping them silently', () => {
    const { transport } = stubTransport({
      events: [NOTE, { ...NOTE, id: 9005, note: { noteable_type: 'MergeRequest', noteable_iid: 413 } }],
    });
    const collection = collect(transport, { maxMergeRequestLookups: 1 });

    expect(collection.events).toHaveLength(2);
    expect(collection.failures[0]).toContain('1 more merge request');
  });

  it('keys an event by GitLab’s own id, so an overlapping run appends nothing twice', () => {
    const { transport } = stubTransport({ events: [NOTE] });
    const [event] = collect(transport).events;

    expect(dedupeKeyOf(event!)).toBe(dedupeKeyOf(collect(stubTransport({ events: [NOTE] }).transport).events[0]!));
  });
});
