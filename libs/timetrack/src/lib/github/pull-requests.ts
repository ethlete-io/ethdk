import { Observable, map } from 'rxjs';
import { forgeApi$ } from '../forge/cli';
import { TimetrackProcessRunner } from '../transport/ports';
import { GITHUB_HOST } from './events';

/** A pull request, reduced to the two things the activity feed does not already carry. */
export type GitHubPullRequest = {
  title: string;
  /** The head ref. Already known from the feed for every event but a comment, and read again here. */
  branch: string;
};

type GitHubPullRequestResource = {
  title?: string;
  head?: { ref?: string };
};

/** The browser URL, which the feed never carries and which is a fixed shape rather than a lookup. */
export const gitHubPullRequestUrl = (options: { repo: string; number: string }) =>
  `https://${GITHUB_HOST}/${options.repo}/pull/${options.number}`;

/**
 * One pull request by repository and number.
 *
 * A comment event names the pull request and its title but never its branch, and every other event
 * names the branch and never the title, so one lookup completes whichever half is missing. It is made
 * once per pull request a day touched, not once per event.
 */
export const fetchGitHubPullRequest$ = (options: {
  runner: TimetrackProcessRunner;
  repo: string;
  number: string;
}): Observable<GitHubPullRequest | null> =>
  forgeApi$<GitHubPullRequestResource>({
    runner: options.runner,
    cli: 'gh',
    hostname: GITHUB_HOST,
    path: `/repos/${options.repo}/pulls/${encodeURIComponent(options.number)}`,
    describe: `pull request #${options.number} in ${options.repo}`,
  }).pipe(map((body) => (body?.head?.ref ? { title: body.title ?? '', branch: body.head.ref } : null)));
