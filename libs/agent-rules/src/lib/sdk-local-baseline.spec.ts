import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, '..', '..', 'content', 'skills', 'sdk-local-build', 'sdk-local-baseline.mjs');

describe('sdk local-build baseline', () => {
  it('preserves pre-existing manifest and lockfile edits byte for byte', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdk-local-baseline-'));
    const baselineDir = join(root, 'baseline');
    const manifest = join(root, 'package.json');
    const lockfile = join(root, 'yarn.lock');
    const originalManifest = '{\n  "dependencies": { "other": "workspace:*" },\n  "userEdit": true\n}\n';
    const originalLockfile = '# user edit\nother@workspace:*:\n  version: 0.0.0-use.local\n';
    const { captureBaseline, restoreBaseline, verifyBaseline } = await import(pathToFileURL(script).href);

    writeFileSync(manifest, originalManifest);
    writeFileSync(lockfile, originalLockfile);
    captureBaseline(manifest, lockfile, baselineDir);

    writeFileSync(manifest, originalManifest.replace('workspace:*', 'file:../sdk/dist/libs/components'));
    writeFileSync(lockfile, `${originalLockfile}local-sdk-resolution: abc123\n`);
    restoreBaseline(manifest, lockfile, baselineDir);
    verifyBaseline(manifest, lockfile, baselineDir);

    expect(readFileSync(manifest, 'utf8')).toBe(originalManifest);
    expect(readFileSync(lockfile, 'utf8')).toBe(originalLockfile);
  });
});
