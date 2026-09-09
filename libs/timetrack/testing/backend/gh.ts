/* eslint-disable @typescript-eslint/naming-convention -- GitHub's REST wire format is snake_case. */
import { ProcessResult, ProcessSpec } from '@ethlete/timetrack';
import { FakeForgeCliState, forgeAuthReport, forgeEndpointOf } from './forge-cli';

/** One pull request event on the seeded account's feed, in the shape a spec is easiest to read in. */
export type FakeGitHubEvent = {
  id: string;
  /** An ISO instant. */
  at: string;
  repo: string;
  number: string;
  /** `review`, `comment` or `opened`. The three shapes carry different halves of the same fact. */
  kind: 'review' | 'comment' | 'opened';
  /** The head ref. A comment event never has one, whatever this says. */
  branch?: string;
  /** The title. Only a comment event carries one on the feed. */
  title?: string;
};

export type FakeGitHubPullRequest = { repo: string; number: string; title: string; branch: string };

export type FakeGitHubState = FakeForgeCliState & {
  events: FakeGitHubEvent[];
  pullRequests: FakeGitHubPullRequest[];
};

export const isGhSpec = (spec: ProcessSpec) => spec.command === 'gh';

const eventResource = (event: FakeGitHubEvent) => {
  const base = { id: event.id, created_at: event.at, repo: { name: event.repo } };

  if (event.kind === 'comment') {
    return {
      ...base,
      type: 'IssueCommentEvent',
      payload: { issue: { number: event.number, title: event.title, pull_request: {} } },
    };
  }

  return {
    ...base,
    type: event.kind === 'review' ? 'PullRequestReviewEvent' : 'PullRequestEvent',
    payload: {
      action: event.kind === 'opened' ? 'opened' : 'created',
      ...(event.kind === 'review' ? { review: { state: 'approved' } } : {}),
      pull_request: { number: event.number, head: { ref: event.branch } },
    },
  };
};

const pullRequestResource = (held: FakeGitHubPullRequest) => ({ title: held.title, head: { ref: held.branch } });

const refused = (status: number, message: string): ProcessResult => ({
  code: 1,
  stdout: JSON.stringify({ message }),
  stderr: `gh: ${message} (HTTP ${status})`,
});

/**
 * Runs one `gh` call against the seeded GitHub state.
 *
 * The feed takes no date range and pages with `page` alone, and a page past the third is an HTTP 422
 * rather than an empty one — both measured on 2026-09-10. Reproducing the 422 is the point: a reader
 * that pages past the cap has to stop rather than report a failure.
 */
export const runFakeGh = (options: { spec: ProcessSpec; state: FakeGitHubState }): ProcessResult => {
  const { spec, state } = options;
  const [verb] = spec.args;

  if (verb === 'auth') {
    return {
      code: state.logins.length > 0 ? 0 : 1,
      stdout: forgeAuthReport({ cli: 'gh', state, emptyHost: 'github.com' }),
      stderr: '',
    };
  }

  if (verb !== 'api') return { code: 1, stdout: '', stderr: `gh: unknown command ${String(verb)}` };

  const url = new URL(forgeEndpointOf(spec).replace(/^\/?/, '/'), 'https://api.github.com');
  const pull = /^\/repos\/(.+)\/pulls\/(\d+)$/.exec(url.pathname);

  if (pull) {
    const held = state.pullRequests.find((request) => request.repo === pull[1] && request.number === pull[2]);

    return held
      ? { code: 0, stdout: JSON.stringify(pullRequestResource(held)), stderr: '' }
      : refused(404, 'Not Found');
  }

  if (!/^\/users\/[^/]+\/events$/.test(url.pathname)) return refused(404, 'Not Found');

  const page = Number(url.searchParams.get('page') ?? '1');
  const size = Number(url.searchParams.get('per_page') ?? '30');

  if (page > 3) return refused(422, 'In order to keep the API fast for everyone, pagination is limited.');

  const slice = state.events.slice((page - 1) * size, page * size);

  return { code: 0, stdout: JSON.stringify(slice.map(eventResource)), stderr: '' };
};
