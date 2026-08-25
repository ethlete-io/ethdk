/**
 * Moves the prerelease dist tag onto the versions this repo just published.
 *
 * Changesets publishes a package to `latest` instead of the prerelease tag while that package has
 * never had a stable release ("only-pre", see `getReleaseTag` in @changesets/cli). Only its very
 * first publish carries the prerelease tag, so `next` stays pinned to `x.y.z-next.0` forever while
 * `latest` walks forward. A consumer resolving `next` then reads an ancient version, and
 * `et update` sees the tag point backwards.
 *
 * Runs after `changeset publish`, so `dist/libs/<lib>/package.json` holds what went out. Compares
 * the prerelease tag on the registry against the local version and moves it forward when it lags.
 * It never moves a tag backwards, and it leaves `latest` alone - npm needs one, and a package
 * without a stable release has nothing better to point it at.
 *
 * Usage:
 *   node tools/scripts/sync-dist-tags.js             # move the tags
 *   node tools/scripts/sync-dist-tags.js --dry-run   # print what it would move
 */

const { execFileSync } = require('child_process');
const { existsSync, readFileSync, readdirSync } = require('fs');
const { join, resolve } = require('path');
const semver = require('semver');

const ROOT = resolve(__dirname, '../..');
const PRE_STATE = join(ROOT, '.changeset/pre.json');
const DIST_LIBS = join(ROOT, 'dist/libs');

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

/** The tag the repo publishes prereleases to, or `undefined` when it is not in prerelease mode. */
const prereleaseTag = () => {
  const state = readJson(PRE_STATE);

  return state && state.mode === 'pre' && typeof state.tag === 'string' ? state.tag : undefined;
};

const publishedPackages = () => {
  if (!existsSync(DIST_LIBS)) return [];

  return readdirSync(DIST_LIBS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson(join(DIST_LIBS, entry.name, 'package.json')))
    .filter((manifest) => manifest && manifest.name && manifest.version && manifest.private !== true)
    .map((manifest) => ({ name: manifest.name, version: manifest.version }));
};

const npm = (args) => execFileSync('npm', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** What the registry says the tag points at, or `undefined` when it has no such tag. */
const taggedVersion = (name, tag) => {
  let output;

  try {
    output = npm(['view', `${name}@${tag}`, 'version', '--json']);
  } catch {
    return undefined;
  }

  const parsed = JSON.parse(output.trim() || 'null');
  const versions = Array.isArray(parsed) ? parsed : [parsed];

  return typeof versions[versions.length - 1] === 'string' ? versions[versions.length - 1] : undefined;
};

const main = () => {
  const dryRun = process.argv.includes('--dry-run');
  const tag = prereleaseTag();

  if (!tag) {
    console.log('Not in prerelease mode, so there is no prerelease tag to move.');

    return 0;
  }

  const packages = publishedPackages();

  if (packages.length === 0) {
    console.error(`No package manifest under ${DIST_LIBS}. Build before you release.`);

    return 1;
  }

  const failures = [];
  let moved = 0;

  for (const { name, version } of packages) {
    if (semver.prerelease(version)?.[0] !== tag) continue;

    const current = taggedVersion(name, tag);

    if (current === version) continue;

    if (current !== undefined && semver.gt(current, version)) {
      console.log(`  ${name}: "${tag}" already points at ${current}, which is newer than ${version}. Left alone.`);
      continue;
    }

    const from = current === undefined ? 'nothing' : current;

    if (dryRun) {
      console.log(`  ${name}: "${tag}" would move from ${from} to ${version}.`);
      continue;
    }

    try {
      npm(['dist-tag', 'add', `${name}@${version}`, tag]);
      console.log(`  ${name}: "${tag}" moved from ${from} to ${version}.`);
      moved += 1;
    } catch (error) {
      failures.push(`${name}: ${error.stderr || error.message}`);
    }
  }

  for (const failure of failures) console.error(`  ${failure}`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} dist tag(s) could not be moved.`);

    return 1;
  }

  if (dryRun) console.log(`\nDry run: no dist tag was moved.`);
  else console.log(`\n"${tag}" is correct for every published package (${moved} moved).`);

  return 0;
};

process.exit(main());
