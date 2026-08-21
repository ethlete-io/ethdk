/**
 * A private dependency that will not download is the most common way these commands fail, and git
 * and the package managers report it as a bare 403 or a public-key error. This says what to check.
 */
export const printPrivateDependencyHint = (options: { repoHost?: string }) => {
  const host = options.repoHost ?? 'your git host';

  console.error(
    `\nThat command may have failed because a private dependency could not be downloaded.\n` +
      `Three things are worth checking:\n\n` +
      `  1. A personal access token for ${host} with permission to DOWNLOAD code.\n` +
      `     Read access is not enough for a clone, and the server reports the difference as 403.\n` +
      `  2. An SSH key this machine offers to ${host}, when the dependency is fetched over SSH.\n` +
      `  3. That the token is where the package manager looks for it, not only in your shell.\n` +
      `     Composer, for example, reads ~/.composer/auth.json rather than the environment.`,
  );
};

/** The host of a git url, for naming it in the hint. Undefined when the url has no host. */
export const gitUrlHost = (repoUrl: string) => {
  const scpLike = /^[^/]+@([^:]+):/.exec(repoUrl);

  if (scpLike) return scpLike[1];

  try {
    return new URL(repoUrl).hostname || undefined;
  } catch {
    return undefined;
  }
};

/** The `group/project` part of a git url, for addressing the project in a host's own API. */
export const gitUrlProjectPath = (repoUrl: string) => {
  const scpLike = /^[^/]+@[^:]+:(.+)$/.exec(repoUrl);

  if (scpLike) return (scpLike[1] ?? '').replace(/\.git$/, '') || undefined;

  try {
    return new URL(repoUrl).pathname.replace(/^\/+/, '').replace(/\.git$/, '') || undefined;
  } catch {
    return undefined;
  }
};
