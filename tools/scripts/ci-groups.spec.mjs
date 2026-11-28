import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import {
  forcedGroups,
  GROUPS,
  githubOutput,
  rootManifestRule,
  selectGroups,
  usableBase,
  workflowHelperGroups,
} from './ci-groups.mjs';
import { git, tempGitRepo } from './git-test-env.mjs';

const roots = {
  core: 'libs/core',
  components: 'libs/components',
  cli: 'libs/cli',
  design: 'libs/design',
  'eslint-plugin': 'libs/eslint-plugin',
  'ethlete-studio': 'apps/ethlete-studio',
  'timetrack-app': 'apps/timetrack',
  timetrack: 'libs/timetrack',
};
const dependencies = {
  components: ['core'],
  cli: ['design', 'eslint-plugin'],
  design: ['cli', 'components', 'eslint-plugin'],
  'ethlete-studio': ['cli', 'components', 'core'],
  'timetrack-app': ['timetrack', 'core', 'components'],
};

const select = (changedFiles, affected, force) => selectGroups({ changedFiles, affected, roots, dependencies, force });
const summary = (selection) =>
  Object.fromEntries(Object.entries(selection).map(([group, { run, projects }]) => [group, run ? projects : null]));

test('a Timetrack-only change runs only the Timetrack group', () => {
  const selection = select(['apps/timetrack/src/main.ts', '.changeset/tt.md'], ['timetrack-app']);

  assert.deepEqual(summary(selection), { sdk: null, studio: null, timetrack: ['timetrack-app'] });
});

test('a Studio-only change runs only the Studio group', () => {
  const selection = select(['apps/ethlete-studio/src/app.ts'], ['ethlete-studio']);

  assert.deepEqual(summary(selection), { sdk: null, studio: ['ethlete-studio'], timetrack: null });
});

test('a lib both apps import runs every group through the affected graph', () => {
  const selection = select(
    ['libs/core/src/index.ts'],
    ['core', 'components', 'cli', 'ethlete-studio', 'timetrack-app'],
  );

  assert.deepEqual(summary(selection), {
    sdk: ['cli', 'components', 'core'],
    studio: ['ethlete-studio'],
    timetrack: ['timetrack-app'],
  });
});

test('a design tool change runs the design and cli checks in the Studio group, not the SDK group', () => {
  const selection = select(['libs/design/src/lib/design/server.ts'], ['cli', 'design', 'ethlete-studio']);

  assert.deepEqual(summary(selection), { sdk: null, studio: ['cli', 'design', 'ethlete-studio'], timetrack: null });
});

test('a cli change next to a design tool change keeps cli and design in the SDK group', () => {
  const selection = select(
    ['libs/design/src/lib/design/server.ts', 'libs/cli/src/lib/update/plan.ts'],
    ['cli', 'design', 'ethlete-studio'],
  );

  assert.deepEqual(summary(selection), { sdk: ['cli', 'design'], studio: ['ethlete-studio'], timetrack: null });
});

test('a design tool change next to a change in a design dependency keeps cli and design in the SDK group', () => {
  const selection = select(
    ['libs/design/src/lib/design/server.ts', 'libs/eslint-plugin/src/index.ts'],
    ['cli', 'design', 'eslint-plugin', 'ethlete-studio'],
  );

  assert.deepEqual(summary(selection).sdk, ['cli', 'design', 'eslint-plugin']);
});

test('plans and changesets alone run nothing', () => {
  assert.deepEqual(summary(select(['plans/QUEUE.md', '.changeset/a.md'], [])), {
    sdk: null,
    studio: null,
    timetrack: null,
  });
});

test('a file no project owns runs the SDK repo checks without projects', () => {
  assert.deepEqual(summary(select(['tools/scripts/heavy.mjs'], [])), { sdk: [], studio: null, timetrack: null });
});

test('Studio design data runs the Studio group', () => {
  assert.deepEqual(summary(select(['.ethlete/design/config.json'], [])), {
    sdk: null,
    studio: ['ethlete-studio'],
    timetrack: null,
  });
});

test('a change to the app workflows runs both app groups in full', () => {
  assert.deepEqual(summary(select(['.github/workflows/ci-apps.yml'], [])), {
    sdk: null,
    studio: ['ethlete-studio'],
    timetrack: ['timetrack', 'timetrack-app'],
  });
});

test('a change to the CEF action runs only the app groups, other actions run everything', () => {
  assert.equal(select(['.github/actions/cef/action.yml'], []).sdk.run, false);
  assert.deepEqual(summary(select(['.github/actions/setup/action.yml'], [])).sdk, [
    'cli',
    'components',
    'core',
    'design',
    'eslint-plugin',
  ]);
});

test('a forced group runs all its projects, for an app with a pending release', () => {
  assert.deepEqual(summary(select([], [], ['timetrack'])), {
    sdk: null,
    studio: null,
    timetrack: ['timetrack', 'timetrack-app'],
  });
});

test('writes one run flag and one project list per group', () => {
  assert.equal(
    githubOutput(select(['apps/timetrack/src/main.ts'], ['timetrack-app'])),
    'sdk=false\nsdk_projects=\nstudio=false\nstudio_projects=\ntimetrack=true\ntimetrack_projects=timetrack-app\nbase=\n',
  );
});

test('writes the verified base for the jobs that diff from it', () => {
  assert.match(githubOutput(select([], []), 'abc123'), /\nbase=abc123\n$/);
});

test('no previous green run forces every group', () => {
  assert.deepEqual(forcedGroups({ noBase: false, noPreviousBuild: true, force: [] }), GROUPS);
  assert.deepEqual(forcedGroups({ noBase: false, noPreviousBuild: false, force: ['studio'] }), ['studio']);
});

test('a base outside the history of HEAD is not usable', () => {
  const dir = tempGitRepo('ci-groups-');
  try {
    git(dir, 'commit', '--allow-empty', '-m', 'root');
    const root = git(dir, 'rev-parse', 'HEAD').trim();
    git(dir, 'commit', '--allow-empty', '-m', 'head');
    const head = git(dir, 'rev-parse', 'HEAD').trim();
    git(dir, 'checkout', '-q', '--orphan', 'other');
    git(dir, 'commit', '--allow-empty', '-m', 'unrelated');
    const unrelated = git(dir, 'rev-parse', 'HEAD').trim();

    assert.equal(usableBase(root, head, dir), true);
    assert.equal(usableBase(unrelated, head, dir), false);
    assert.equal(usableBase('1234567890123456789012345678901234567890', head, dir), false);
    assert.equal(usableBase('0000000000000000000000000000000000000000', head, dir), false);
    assert.equal(usableBase('', head, dir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const manifest = (scripts, extra = {}) => ({ name: 'source', scripts, ...extra });

test('a root studio: script change runs the Studio group with its app', () => {
  const rootManifests = { base: manifest({ 'studio:e2e': 'a' }), head: manifest({ 'studio:e2e': 'b' }) };

  assert.deepEqual(
    summary(selectGroups({ changedFiles: ['package.json'], affected: [], roots, dependencies, rootManifests })),
    { sdk: null, studio: ['ethlete-studio'], timetrack: null },
  );
});

test('root script changes map by prefix, other manifest changes keep the SDK group', () => {
  assert.deepEqual(rootManifestRule(manifest({}), manifest({ 'timetrack:build': 'x' })), {
    groups: ['timetrack'],
    projects: ['timetrack-app'],
  });
  assert.deepEqual(rootManifestRule(manifest({ lint: 'a' }), manifest({ lint: 'b' })).groups, ['sdk']);
  assert.deepEqual(rootManifestRule(manifest({}), manifest({}, { devDependencies: { nx: '1' } })).groups, ['sdk']);
});

test('a shared CI helper runs every group whose workflows call it, in full', () => {
  const workflows = Object.fromEntries(
    ['ci.yml', 'ci-apps.yml', 'release-apps.yml'].map((name) => [
      name,
      readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8'),
    ]),
  );
  const helperGroups = workflowHelperGroups(workflows);

  assert.deepEqual(helperGroups['tools/scripts/ci-apt-retry.sh'].sort(), ['sdk', 'studio', 'timetrack']);
  assert.deepEqual(helperGroups['tools/scripts/verify-webkit-design-events.mjs'], ['studio']);
  assert.deepEqual(
    summary(
      selectGroups({
        changedFiles: ['tools/scripts/ci-apt-retry.sh'],
        affected: [],
        roots,
        dependencies,
        helperGroups,
      }),
    ),
    {
      sdk: ['cli', 'components', 'core', 'design', 'eslint-plugin'],
      studio: ['ethlete-studio'],
      timetrack: ['timetrack', 'timetrack-app'],
    },
  );
});
