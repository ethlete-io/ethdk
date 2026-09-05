/**
 * Changelog generator for this repository, in place of `@changesets/changelog-github`.
 *
 * That generator spends about 240 characters per entry on a pull request link, a commit link and a
 * `Thanks [@…]` attribution. Every entry of a release here carries the same release pull request
 * number and the `github-actions` bot as its author, so only the commit identifies the change.
 * Keeping the commit link and dropping the rest is what holds the release notes inside GitHub's
 * 125,000 character release body. It also needs no `GITHUB_TOKEN`, so `changeset version` runs
 * offline.
 */

const commitLink = (commit, repo) => {
  if (!commit) return '';

  const short = commit.slice(0, 7);

  return repo ? `[\`${short}\`](https://github.com/${repo}/commit/${commit}) ` : `${short} `;
};

const getReleaseLine = async (changeset, _type, options) => {
  const [firstLine, ...futureLines] = changeset.summary.split('\n').map((line) => line.trimEnd());
  const rest = futureLines.length > 0 ? `\n${futureLines.map((line) => `  ${line}`).join('\n')}` : '';

  return `- ${commitLink(changeset.commit, options && options.repo)}${firstLine}${rest}`;
};

/**
 * One line for the whole bump instead of one per contributing changeset. A release that consumes
 * hundreds of changesets otherwise repeats `- Updated dependencies [sha]` hundreds of times.
 */
const getDependencyReleaseLine = async (_changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return '';

  return ['- Updated dependencies:', ...dependenciesUpdated.map((d) => `  - ${d.name}@${d.newVersion}`)].join('\n');
};

module.exports = { getReleaseLine, getDependencyReleaseLine };
