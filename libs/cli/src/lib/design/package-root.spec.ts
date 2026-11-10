import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorAssetRootOf } from './package-root';

describe('editorAssetRootOf', () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('treats a missing running root under a symlinked parent of the checkout tmp folder as transient', () => {
    const real = realpathSync(mkdtempSync(join(tmpdir(), 'cli-package-root-')));
    const link = `${real}-link`;

    dirs.push(real, link);
    mkdirSync(join(real, 'checkout'));
    symlinkSync(real, link);
    vi.stubEnv('TMPDIR', join(real, 'elsewhere'));

    expect(editorAssetRootOf(join(real, 'checkout'), join(link, 'checkout/tmp/cli-build/design'))).toBeNull();
  });

  it('keeps a running root outside every transient folder', () => {
    const real = realpathSync(mkdtempSync(join(tmpdir(), 'cli-package-root-')));

    dirs.push(real);
    mkdirSync(join(real, 'checkout'));

    expect(editorAssetRootOf(join(real, 'checkout'), '/opt/ethlete/cli/design')).toBe('/opt/ethlete/cli/design');
  });
});
