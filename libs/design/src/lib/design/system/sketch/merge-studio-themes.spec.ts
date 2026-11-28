import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { gitSpawn } from '@ethlete/cli-core/git-test-env.fixtures';
import { ResolvedProduct } from '../resolve-product';
import { regenerateStudioThemesOf } from './merge-studio-themes';

const productOf = (name: string) => ({ name }) as ResolvedProduct;

const checkoutWith = (script: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-themes-'));

  mkdirSync(join(target, 'tools/scripts'), { recursive: true });
  mkdirSync(join(target, 'apps/ethlete-studio/src'), { recursive: true });
  writeFileSync(join(target, 'tools/scripts/generate-studio-themes.mjs'), script);
  gitSpawn(['init'], { cwd: target, encoding: 'utf8' });

  return target;
};

const WRITES = `import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../../apps/ethlete-studio/src/themes.ts', import.meta.url), 'export {};\\n');
`;

describe('regenerateStudioThemesOf', () => {
  it('runs the generator for a studio merge of foundations/colors and answers the files it wrote', () => {
    const target = checkoutWith(WRITES);

    expect(regenerateStudioThemesOf({ target, product: productOf('studio'), parts: ['foundations/colors'] })).toEqual([
      expect.stringMatching(/apps\/ethlete-studio\/src\/themes\.ts$/),
    ]);
  });

  it('does nothing for another part or another product', () => {
    const target = checkoutWith(WRITES);

    expect(regenerateStudioThemesOf({ target, product: productOf('studio'), parts: ['elements/hero'] })).toEqual([]);
    expect(regenerateStudioThemesOf({ target, product: productOf('acme'), parts: ['foundations/colors'] })).toEqual([]);
  });

  it('warns and answers none when the generator fails', () => {
    const target = checkoutWith('process.exit(1);\n');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(regenerateStudioThemesOf({ target, product: productOf('studio'), parts: ['foundations/colors'] })).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('yarn studio:themes'));
  });
});
