/* eslint-disable @typescript-eslint/naming-convention -- GitHub's REST wire format is snake_case. */
import { Observable, map } from 'rxjs';
import { ForgePagingOptions, forgeApiPaged$ } from '../forge/cli';
import { TimetrackProcessRunner } from '../transport/ports';

/** The host every `gh` call goes to. GitHub Enterprise would make this a setting. */
export const GITHUB_HOST = 'github.com';

/**
 * The feed stops at 300 events, and asking for page 4 is an HTTP 422 rather than an empty page. So the
 * cap is expressed here instead of being discovered as a failure.
 */
export const GITHUB_MAX_PAGES = 3;

export const GITHUB_PAGE_SIZE = 100;

/** One thing the user did to a pull request, as GitHub's own activity feed reports it. */
export type GitHubEvent = {
  id: string;
  at: Date;
  /** Wording that reads the way GitLab's `action_name` does — `opened`, `reviewed`, `commented on`. */
  action: string;
  /** The repository, `owner/name` as GitHub spells it. */
  repo: string;
  pullRequestNumber: string;
  /** The head ref, which the feed carries for every event whose payload holds a pull request. */
  branch?: string;
  /** Only a comment event carries one; the trimmed pull request in every other payload has no title. */
  title?: string;
};

type GitHubEventResource = {
  id?: number | string;
  type?: string;
  created_at?: string;
  repo?: { name?: string };
  payload?: {
    action?: string;
    pull_request?: { number?: number | string; head?: { ref?: string } };
    issue?: { number?: number | string; title?: string; pull_request?: unknown };
    review?: { state?: string };
  };
};

/**
 * GitHub's wording for what an event was, in the tense GitLab's `action_name` uses.
 *
 * A review's own `payload.action` is always `created`, so the state is what says whether it was an
 * approval — which is the one review outcome a reader of the day would notice missing.
 */
const actionOf = (resource: GitHubEventResource) => {
  const { type, payload } = resource;

  if (type === 'PullRequestReviewEvent') return payload?.review?.state === 'approved' ? 'approved' : 'reviewed';
  if (type === 'PullRequestReviewCommentEvent' || type === 'IssueCommentEvent') return 'commented on';
  if (type === 'PullRequestEvent') return payload?.action ?? 'changed';

  return 'did something to';
};

/**
 * The pull request an event was about, or `undefined` when it was about something else.
 *
 * The two shapes are complementary and neither gives both halves. Measured on 2026-09-10:
 * `payload.pull_request` is trimmed to `{base, head, id, number, url}`, so it carries the head ref and
 * no title; `payload.issue` on a comment carries the number and the title and no ref. An issue that is
 * not a pull request has no `pull_request` key on it, which is the only way to tell the two apart.
 */
const pullRequestOf = (resource: GitHubEventResource) => {
  const pullRequest = resource.payload?.pull_request;

  if (pullRequest?.number !== undefined) {
    return { number: String(pullRequest.number), branch: pullRequest.head?.ref, title: undefined };
  }

  const issue = resource.payload?.issue;

  if (issue?.pull_request !== undefined && issue.number !== undefined) {
    return { number: String(issue.number), branch: undefined, title: issue.title };
  }

  return undefined;
};

const toEvent = (resource: GitHubEventResource): GitHubEvent | undefined => {
  const at = resource.created_at ? new Date(resource.created_at) : undefined;
  const pullRequest = pullRequestOf(resource);
  const repo = resource.repo?.name;

  if (resource.id === undefined || !repo || !pullRequest || !at || Number.isNaN(at.getTime())) return undefined;

  return {
    id: String(resource.id),
    at,
    action: actionOf(resource),
    repo,
    pullRequestNumber: pullRequest.number,
    branch: pullRequest.branch,
    title: pullRequest.title,
  };
};

export type GitHubEventPage = {
  events: GitHubEvent[];
  /**
   * How far back the read actually got, set only when the feed's own cap stopped it inside the window.
   * `null` means the whole window was covered, however few events came back.
   */
  reachedBackTo: Date | null;
};

/**
 * The user's own pull request activity inside a window.
 *
 * The feed takes no `after` and no `before`: it is newest-first and stops at 300 events, so the window
 * is applied after the read. `reachedBackTo` says where the cap left off, because a first run over
 * thirty days silently returning three days of it is the failure this has to be able to report.
 */
export const fetchGitHubEvents$ = (options: {
  runner: TimetrackProcessRunner;
  login: string;
  from: Date;
  to: Date;
  paging?: Partial<ForgePagingOptions>;
}): Observable<GitHubEventPage> => {
  const paging = { pageSize: GITHUB_PAGE_SIZE, maxPages: GITHUB_MAX_PAGES, ...options.paging };

  return forgeApiPaged$<GitHubEventResource>({
    runner: options.runner,
    cli: 'gh',
    hostname: GITHUB_HOST,
    path: `/users/${encodeURIComponent(options.login)}/events`,
    describe: `your GitHub activity as ${options.login}`,
    paging,
  }).pipe(
    map((resources) => {
      const read = resources.flatMap((resource) => toEvent(resource) ?? []);
      // Only a read that filled every page it was allowed can have been cut short. Fewer events than
      // that is the whole feed, however recent its oldest entry is.
      const capped = resources.length >= paging.pageSize * paging.maxPages;
      const oldest = resources.reduce<Date | null>((held, resource) => {
        const at = resource.created_at ? new Date(resource.created_at) : null;

        return at && !Number.isNaN(at.getTime()) && (!held || at < held) ? at : held;
      }, null);

      return {
        events: read.filter((event) => event.at >= options.from && event.at <= options.to),
        reachedBackTo: capped && oldest && oldest > options.from ? oldest : null,
      };
    }),
  );
};
