/**
 * Changelog generator for this repository, in place of `@changesets/changelog-github`.
 *
 * An entry is only its note. The pull request link, commit link and `Thanks [@…]` attribution of
 * that generator cost about 240 characters per entry and identify nothing here: every entry of a
 * release shares the release pull request and the `github-actions` bot. That keeps the release
 * notes inside GitHub's 125,000 character release body, and `changeset version` runs offline.
 */

const getReleaseLine = async (changeset) => {
  const [firstLine, ...futureLines] = changeset.summary.split('\n').map((line) => line.trimEnd());
  const rest = futureLines.length > 0 ? `\n${futureLines.map((line) => `  ${line}`).join('\n')}` : '';

  return `- ${firstLine}${rest}`;
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
