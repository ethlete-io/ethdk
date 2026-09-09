import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GitHubEventPage, fetchGitHubEvents$ } from './events';

const eventRunner = (pages: unknown[][]) => {
  const specs: ProcessSpec[] = [];
  let page = 0;
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const current = pages[page] ?? [];
      page += 1;

      return of({ code: 0, stdout: JSON.stringify(current), stderr: '' });
    }),
  };

  return { runner, specs };
};

const read = (runner: TimetrackProcessRunner, options: { pageSize?: number; maxPages?: number } = {}) => {
  const seen = vi.fn();

  fetchGitHubEvents$({
    runner,
    login: 'TomTomB',
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
    paging: { pageSize: options.pageSize ?? 1, maxPages: options.maxPages ?? 3 },
  }).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? { events: [], reachedBackTo: null }) as GitHubEventPage;
};

/** A review event, with the trimmed pull request GitHub really sends. It carries no title and no URL. */
const REVIEW = {
  id: '55001',
  type: 'PullRequestReviewEvent',
  created_at: '2026-08-11T09:15:00.000Z',
  repo: { name: 'braune-digital/fut-frontend' },
  payload: {
    action: 'created',
    review: { state: 'approved' },
    pull_request: {
      id: 1,
      number: 412,
      url: 'https://api.github.com/repos/x/y/pulls/412',
      head: { ref: 'feat/ABC-1' },
    },
  },
};

/** A comment on a pull request. This is the one shape that carries a title, and it carries no head ref. */
const COMMENT = {
  id: '55002',
  type: 'IssueCommentEvent',
  created_at: '2026-08-11T09:20:00.000Z',
  repo: { name: 'braune-digital/fut-frontend' },
  payload: {
    action: 'created',
    issue: {
      number: 412,
      title: 'Password reset',
      html_url: 'https://github.com/braune-digital/fut-frontend/pull/412',
      pull_request: { url: 'https://api.github.com/repos/x/y/pulls/412' },
    },
  },
};

describe('fetchGitHubEvents$', () => {
  it('asks for the account`s own feed, which is what returns private events too', () => {
    const { runner, specs } = eventRunner([[]]);

    read(runner);

    expect(specs[0]?.command).toBe('gh');
    expect(specs[0]?.args.at(-1)).toContain('users/TomTomB/events');
  });

  it('takes the head ref off a review, which is the whole issue key and needs no second call', () => {
    const page = read(eventRunner([[REVIEW], []]).runner);

    expect(page.events[0]).toMatchObject({
      id: '55001',
      action: 'approved',
      repo: 'braune-digital/fut-frontend',
      pullRequestNumber: '412',
      branch: 'feat/ABC-1',
    });
    expect(page.events[0]?.title).toBeUndefined();
  });

  it('says a review that approved nothing was a review, not an approval', () => {
    const reviewed = { ...REVIEW, payload: { ...REVIEW.payload, review: { state: 'commented' } } };

    expect(read(eventRunner([[reviewed], []]).runner).events[0]?.action).toBe('reviewed');
  });

  it('takes the title off a comment, which is the one shape that has one and has no head ref', () => {
    const page = read(eventRunner([[COMMENT], []]).runner);

    expect(page.events[0]).toMatchObject({ pullRequestNumber: '412', title: 'Password reset' });
    expect(page.events[0]?.branch).toBeUndefined();
  });

  it('drops a comment on an issue that is not a pull request, which looks the same but for one key', () => {
    const onAnIssue = { ...COMMENT, payload: { action: 'created', issue: { number: 9, title: 'A bug' } } };

    expect(read(eventRunner([[onAnIssue], []]).runner).events).toEqual([]);
  });

  it('drops a push, which GitHub reports with no pull request at all', () => {
    const push = {
      id: '55003',
      type: 'PushEvent',
      created_at: '2026-08-11T10:00:00.000Z',
      repo: { name: 'braune-digital/fut-frontend' },
      payload: { ref: 'refs/heads/next' },
    };

    expect(read(eventRunner([[push], []]).runner).events).toEqual([]);
  });

  it('drops what fell outside the window, which the feed has no way to be asked for', () => {
    const older = { ...REVIEW, id: '1', created_at: '2026-08-09T09:00:00.000Z' };

    expect(read(eventRunner([[older], [REVIEW], []]).runner).events.map((event) => event.id)).toEqual(['55001']);
  });

  it('reports how far back it got when the feed`s own cap cut the window short', () => {
    const page = read(eventRunner([[REVIEW], [REVIEW], [REVIEW]]).runner, { pageSize: 1, maxPages: 3 });

    expect(page.reachedBackTo).toEqual(new Date('2026-08-11T09:15:00.000Z'));
  });

  it('reports nothing when the feed simply held fewer events than the cap', () => {
    expect(read(eventRunner([[REVIEW], []]).runner).reachedBackTo).toBeNull();
  });
});
