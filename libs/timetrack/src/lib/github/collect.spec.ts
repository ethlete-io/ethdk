import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MergeRequestActivityEvent } from '../model/event';
import { dedupeKeyOf } from '../store/dedupe';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GitHubCollection, collectGitHubEvents$ } from './collect';

const REVIEW = {
  id: '55001',
  type: 'PullRequestReviewEvent',
  created_at: '2026-08-11T09:15:00.000Z',
  repo: { name: 'braune-digital/fut-frontend' },
  payload: {
    review: { state: 'approved' },
    pull_request: { number: 412, head: { ref: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset' } },
  },
};

const COMMENT = {
  id: '55002',
  type: 'IssueCommentEvent',
  created_at: '2026-08-11T09:20:00.000Z',
  repo: { name: 'braune-digital/fut-frontend' },
  payload: { issue: { number: 412, title: 'Password reset', pull_request: {} } },
};

const PULL_REQUEST = {
  title: 'Password reset',
  head: { ref: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset' },
};

const endpointOf = (spec: ProcessSpec) => spec.args.at(-1) ?? '';

const stubRunner = (options: { events: unknown[]; pullRequestRefused?: boolean }) => {
  const specs: ProcessSpec[] = [];
  let page = 0;
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);

      if (endpointOf(spec).includes('/pulls/')) {
        return options.pullRequestRefused
          ? of({ code: 1, stdout: '{"message":"Not Found"}', stderr: 'gh: Not Found (HTTP 404)' })
          : of({ code: 0, stdout: JSON.stringify(PULL_REQUEST), stderr: '' });
      }

      page += 1;

      return of({ code: 0, stdout: JSON.stringify(page === 1 ? options.events : []), stderr: '' });
    }),
  };

  return { runner, specs };
};

const collect = (runner: TimetrackProcessRunner, options: { maxPullRequestLookups?: number } = {}) => {
  const seen = vi.fn();

  collectGitHubEvents$({
    runner,
    login: 'TomTomB',
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
    maxPullRequestLookups: options.maxPullRequestLookups,
    paging: { pageSize: 1, maxPages: 3 },
  }).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? { events: [], failures: [] }) as GitHubCollection;
};

const lookupsIn = (specs: ProcessSpec[]) => specs.filter((spec) => endpointOf(spec).includes('/pulls/'));

describe('collectGitHubEvents$', () => {
  it('stores a review with the branch the feed already gave it, and looks nothing up for it', () => {
    const { runner, specs } = stubRunner({ events: [REVIEW] });
    const [event] = collect(runner).events as MergeRequestActivityEvent[];

    expect(event).toMatchObject({
      source: 'github',
      kind: 'merge-request-activity',
      eventId: '55001',
      action: 'approved',
      projectPath: 'braune-digital/fut-frontend',
      mergeRequestIid: '412',
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      url: 'https://github.com/braune-digital/fut-frontend/pull/412',
    });
    expect(lookupsIn(specs)).toHaveLength(1);
  });

  it('looks a comment`s pull request up, because that shape carries the title and never the head ref', () => {
    const { runner, specs } = stubRunner({ events: [COMMENT] });
    const [event] = collect(runner).events as MergeRequestActivityEvent[];

    expect(lookupsIn(specs)).toHaveLength(1);
    expect(event).toMatchObject({
      title: 'Password reset',
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
    });
  });

  it('reads one pull request however many events were left on it', () => {
    const { runner, specs } = stubRunner({ events: [COMMENT, { ...COMMENT, id: '55003' }] });

    expect(collect(runner).events).toHaveLength(2);
    expect(lookupsIn(specs)).toHaveLength(1);
  });

  it('keeps an event whose pull request the login cannot read, and reports why', () => {
    const { runner } = stubRunner({ events: [COMMENT], pullRequestRefused: true });
    const collection = collect(runner);

    expect(collection.events).toHaveLength(1);
    expect((collection.events[0] as MergeRequestActivityEvent).branch).toBeUndefined();
    expect(collection.failures[0]).toContain('pull request #412');
  });

  it('reports the pull requests a run did not read rather than dropping them silently', () => {
    const { runner } = stubRunner({
      events: [COMMENT, { ...COMMENT, id: '55004', payload: { issue: { number: 413, pull_request: {} } } }],
    });
    const collection = collect(runner, { maxPullRequestLookups: 1 });

    expect(collection.events).toHaveLength(2);
    expect(collection.failures[0]).toContain('1 more pull request');
  });

  it('keys an event by its source as well as its id, so a GitLab event with the same id is not it', () => {
    const [event] = collect(stubRunner({ events: [REVIEW] }).runner).events;
    const onGitLab = { ...(event as MergeRequestActivityEvent), source: 'gitlab' as const };

    expect(dedupeKeyOf(event!)).not.toBe(dedupeKeyOf(onGitLab));
    expect(dedupeKeyOf(event!)).toBe(dedupeKeyOf(collect(stubRunner({ events: [REVIEW] }).runner).events[0]!));
  });
});
