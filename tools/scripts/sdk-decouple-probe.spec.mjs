import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appProjectsFrom, initializedServer, probeSteps, staleManifestEntries } from './sdk-decouple-probe.mjs';

const nxGraphNodes = {
  'ethlete-studio': { data: { root: 'apps/ethlete-studio' } },
  'timetrack-app': { data: { root: 'apps/timetrack' } },
  timetrack: { data: { root: 'libs/timetrack' } },
  'timetrack-e2e': { data: { root: 'apps/timetrack-e2e' } },
  'timetrack-vscode': { data: { root: 'apps/timetrack-vscode' } },
  'storybook-e2e': { data: { root: 'apps/storybook-e2e' } },
  cli: { data: { root: 'libs/cli' } },
  'agent-rules': { data: { root: 'libs/agent-rules' } },
  design: { data: { root: 'libs/design' } },
};

test('selects the Studio and Timetrack projects from the Nx graph', () => {
  assert.deepEqual(appProjectsFrom(nxGraphNodes), [
    { name: 'ethlete-studio', root: 'apps/ethlete-studio' },
    { name: 'timetrack', root: 'libs/timetrack' },
    { name: 'timetrack-app', root: 'apps/timetrack' },
    { name: 'timetrack-e2e', root: 'apps/timetrack-e2e' },
    { name: 'timetrack-vscode', root: 'apps/timetrack-vscode' },
  ]);
});

test('installs after deletion, then checks both SDK packages and starts the built MCP entry', () => {
  const [install, ...steps] = probeSteps();
  assert.deepEqual(install, { name: 'yarn install', command: 'yarn', args: ['install'] });
  for (const target of ['build', 'test', 'lint']) {
    const step = steps.shift();
    assert.equal(step.command, 'yarn');
    assert.deepEqual(step.args, [
      'nx',
      'run-many',
      '-t',
      target,
      '-p',
      'cli',
      'agent-rules',
      '--skip-nx-cache',
      '--output-style=static',
      ...(target === 'test' ? ['--run'] : []),
    ]);
  }
  for (const project of ['cli', 'agent-rules']) {
    const step = steps.shift();
    assert.equal(step.command, 'npm');
    assert.deepEqual(step.args, ['pack', '--dry-run', '--json']);
    assert.equal(step.directory, `dist/libs/${project}`);
  }
  const [mcp] = steps;
  assert.equal(steps.length, 1);
  assert.equal(mcp.command, process.execPath);
  assert.deepEqual(mcp.args, ['dist/libs/cli/src/index.js', 'design', 'mcp']);
  assert.ok(mcp.input.endsWith('\n'));
  const request = JSON.parse(mcp.input);
  assert.equal(request.method, 'initialize');
  assert.equal(request.jsonrpc, '2.0');
  assert.equal(request.id, 1);
});

const capturedInitialize = `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"ethlete-design","version":"3.0.0-next.53"}}}
`;
const capturedBuildWarning = `WARN: this cli was built from dd1c6f3b8; libs/cli has commits or uncommitted changes since, so a fix in the source may not be in this build. Rebuild: NX_NO_CLOUD=true npx nx build cli`;
const capturedMissingScript = `Error: Cannot find module '/tmp/apps/ethlete-studio/e2e/canvas.e2e.mjs'
`;

test('reads the initialize response and ignores the build warning', () => {
  assert.equal(initializedServer(capturedBuildWarning), undefined);
  assert.deepEqual(initializedServer(`${capturedBuildWarning}\n${capturedInitialize}`), {
    name: 'ethlete-design',
    version: '3.0.0-next.53',
  });
  assert.equal(initializedServer(capturedInitialize.replace('"id":1', '"id":2')), undefined);
});

test('selects manifest entries implicated by a missing deleted path', () => {
  const manifest = {
    workspaces: ['libs/*', 'apps/ethlete-studio', 'apps/timetrack'],
    scripts: {
      'studio:e2e': 'node apps/ethlete-studio/e2e/canvas.e2e.mjs',
      'studio:e2e:host-signal': 'node apps/ethlete-studio/e2e/host-signal.e2e.mjs',
    },
  };
  const deletedRoots = ['apps/ethlete-studio', 'apps/timetrack'];
  assert.deepEqual(staleManifestEntries(manifest, capturedMissingScript, deletedRoots, '/tmp'), {
    workspaces: ['apps/ethlete-studio'],
    scripts: ['studio:e2e'],
  });
  assert.deepEqual(staleManifestEntries(manifest, capturedBuildWarning, deletedRoots, '/tmp'), {
    workspaces: [],
    scripts: [],
  });
  assert.deepEqual(staleManifestEntries(manifest, capturedMissingScript, deletedRoots, '/elsewhere'), {
    workspaces: [],
    scripts: [],
  });
});
