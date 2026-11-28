import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeManifestOf } from './design-cli-runtime.mjs';

test('the runtime carries the Studio version and the dependencies of @ethlete/cli, not the cli itself', () => {
  const manifest = runtimeManifestOf({
    cliManifest: { name: '@ethlete/cli', version: '3.0.0', dependencies: { vite: '8.4.0' }, peerDependencies: {} },
    studioManifest: { version: '0.2.0' },
  });

  assert.deepEqual(manifest, {
    name: 'ethlete-studio-design-runtime',
    version: '0.2.0',
    private: true,
    dependencies: { vite: '8.4.0' },
  });
});
