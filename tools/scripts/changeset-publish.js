/**
 * Runs `changeset publish`, and in prerelease mode passes the prerelease tag as `--tag`.
 *
 * Without `--tag`, Changesets publishes a package that has never had a stable release to `latest`
 * (see `getReleaseTag` in @changesets/cli), so its prerelease tag never moves. Moving the tag
 * afterwards needs `npm dist-tag add`, which npm trusted publishing does not cover.
 */

const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');

const PRE_STATE = join(resolve(__dirname, '../..'), '.changeset/pre.json');

const prereleaseTag = () => {
  try {
    const state = JSON.parse(readFileSync(PRE_STATE, 'utf8'));

    return state.mode === 'pre' && typeof state.tag === 'string' ? state.tag : undefined;
  } catch {
    return undefined;
  }
};

const tag = prereleaseTag();
const args = ['changeset', 'publish', ...(tag ? ['--tag', tag] : [])];
const { status } = spawnSync('yarn', args, { stdio: 'inherit' });

process.exit(status ?? 1);
