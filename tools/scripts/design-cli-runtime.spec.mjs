import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeManifestOf } from './design-cli-runtime.mjs';

test('the runtime carries the Studio version and the dependencies libs/design declares', () => {
  const manifest = runtimeManifestOf({
    designManifest: { name: '@ethlete/design', version: '0.0.0', private: true, dependencies: { vite: '8.4.0' } },
    studioManifest: { version: '0.2.0' },
  });

  assert.deepEqual(manifest, {
    name: 'ethlete-studio-design-runtime',
    version: '0.2.0',
    private: true,
    dependencies: { vite: '8.4.0' },
  });
});
