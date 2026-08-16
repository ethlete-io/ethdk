/** A project as a remote URL names it: the instance host and the namespaced path. */
export type GitLabProjectRef = { host: string; path: string };

const SCP = /^[^@/\s]+@([^:/\s]+):(.+?)(?:\.git)?\/?$/;
const WITH_SCHEME = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:\s]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/;

/**
 * Reads the project out of a git remote URL, in both spellings git uses — `git@host:group/repo.git`
 * and `https://host/group/repo.git`.
 *
 * The path is what GitLab's REST API takes as a project id once it is URL-encoded, which is why no
 * numeric id has to be looked up first.
 */
export const parseGitLabRemoteUrl = (url: string): GitLabProjectRef | null => {
  const trimmed = url.trim();
  const scp = SCP.exec(trimmed);

  if (scp?.[1] && scp[2]) return { host: scp[1], path: scp[2] };

  const scheme = WITH_SCHEME.exec(trimmed);

  if (scheme?.[1] && scheme[2]) return { host: scheme[1], path: scheme[2] };

  return null;
};
