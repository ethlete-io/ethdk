import assert from 'node:assert/strict';
import { test } from 'node:test';
import { githubOutput, selectGroups } from './ci-groups.mjs';

const roots = {
  core: 'libs/core',
  components: 'libs/components',
  cli: 'libs/cli',
  'eslint-plugin': 'libs/eslint-plugin',
  'ethlete-studio': 'apps/ethlete-studio',
  'timetrack-app': 'apps/timetrack',
  timetrack: 'libs/timetrack',
};
const dependencies = {
  components: ['core'],
  cli: ['components', 'eslint-plugin'],
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

test('a design tool change runs the cli checks in the Studio group, not the SDK group', () => {
  const selection = select(['libs/cli/src/lib/design/server.ts'], ['cli', 'ethlete-studio']);

  assert.deepEqual(summary(selection), { sdk: null, studio: ['cli', 'ethlete-studio'], timetrack: null });
});

test('a cli change outside the design tool keeps cli in the SDK group', () => {
  const selection = select(
    ['libs/cli/src/lib/design/server.ts', 'libs/cli/src/lib/update/plan.ts'],
    ['cli', 'ethlete-studio'],
  );

  assert.deepEqual(summary(selection), { sdk: ['cli'], studio: ['ethlete-studio'], timetrack: null });
});

test('a design tool change next to a change in a cli dependency keeps cli in the SDK group', () => {
  const selection = select(
    ['libs/cli/src/lib/design/server.ts', 'libs/eslint-plugin/src/index.ts'],
    ['cli', 'eslint-plugin', 'ethlete-studio'],
  );

  assert.deepEqual(summary(selection).sdk, ['cli', 'eslint-plugin']);
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
    'sdk=false\nsdk_projects=\nstudio=false\nstudio_projects=\ntimetrack=true\ntimetrack_projects=timetrack-app\n',
  );
});
