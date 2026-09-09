import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MergeRequestActivityEvent } from '../model/event';
import { dedupeKeyOf } from '../store/dedupe';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GitLabCollection, collectGitLabEvents$ } from './collect';

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

const endpointOf = (spec: ProcessSpec) => spec.args.at(-1) ?? '';

const stubRunner = (options: { events: unknown[]; mergeRequest?: unknown; mergeRequestRefused?: boolean }) => {
  const specs: ProcessSpec[] = [];
  let page = 0;
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);

      if (endpointOf(spec).includes('/merge_requests/')) {
        return options.mergeRequestRefused
          ? of({ code: 1, stdout: '{"message":"404 Not Found"}', stderr: 'glab: 404 Not Found (HTTP 404)' })
          : of({ code: 0, stdout: JSON.stringify(options.mergeRequest ?? MERGE_REQUEST), stderr: '' });
      }

      page += 1;

      return of({ code: 0, stdout: JSON.stringify(page === 1 ? options.events : []), stderr: '' });
    }),
  };

  return { runner, specs };
};

const collect = (runner: TimetrackProcessRunner, options: { maxMergeRequestLookups?: number } = {}) => {
  const seen = vi.fn();

  collectGitLabEvents$({
    runner,
    hostname: 'git.example.com',
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
    maxMergeRequestLookups: options.maxMergeRequestLookups,
    paging: { pageSize: 1 },
  }).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? { events: [], failures: [] }) as GitLabCollection;
};

const lookupsIn = (specs: ProcessSpec[]) => specs.filter((spec) => endpointOf(spec).includes('/merge_requests/'));

describe('collectGitLabEvents$', () => {
  it('gives a note event the branch its merge request is on', () => {
    const { runner } = stubRunner({ events: [NOTE] });
    const [event] = collect(runner).events as MergeRequestActivityEvent[];

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
    const { runner, specs } = stubRunner({ events: [NOTE, { ...NOTE, id: 9003 }] });
    const collection = collect(runner);

    expect(collection.events).toHaveLength(2);
    expect(lookupsIn(specs)).toHaveLength(1);
  });

  it('never looks up a push, which already said which branch it moved', () => {
    const { runner, specs } = stubRunner({
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
    const collection = collect(runner);

    expect(lookupsIn(specs)).toEqual([]);
    expect((collection.events[0] as MergeRequestActivityEvent).branch).toBe('feat/FIP-2177-user-management');
  });

  it('keeps an event whose merge request the login cannot read, and reports why', () => {
    const { runner } = stubRunner({ events: [NOTE], mergeRequestRefused: true });
    const collection = collect(runner);

    expect(collection.events).toHaveLength(1);
    expect((collection.events[0] as MergeRequestActivityEvent).branch).toBeUndefined();
    expect(collection.failures[0]).toContain('merge request !412');
  });

  it('drops activity that was about no merge request at all', () => {
    const { runner } = stubRunner({
      events: [
        { id: 1, created_at: '2026-08-11T09:00:00.000+02:00', action_name: 'joined', project_id: 42 },
        { ...NOTE, note: { noteable_type: 'Issue', noteable_iid: 7 } },
      ],
    });

    expect(collect(runner).events).toEqual([]);
  });

  it('reports the merge requests a run did not read rather than dropping them silently', () => {
    const { runner } = stubRunner({
      events: [NOTE, { ...NOTE, id: 9005, note: { noteable_type: 'MergeRequest', noteable_iid: 413 } }],
    });
    const collection = collect(runner, { maxMergeRequestLookups: 1 });

    expect(collection.events).toHaveLength(2);
    expect(collection.failures[0]).toContain('1 more merge request');
  });

  it('keys an event by GitLab’s own id, so an overlapping run appends nothing twice', () => {
    const [event] = collect(stubRunner({ events: [NOTE] }).runner).events;

    expect(dedupeKeyOf(event!)).toBe(dedupeKeyOf(collect(stubRunner({ events: [NOTE] }).runner).events[0]!));
  });
});
