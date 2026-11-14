import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { silenceExpectedConsole } from '../../src/lib/testing/expected-console';
import generate from './generator';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: (path: string) => path.includes('fontawesome-free'),
  readFileSync: () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
}));

describe('icons generator', () => {
  let tree: Tree;

  beforeEach(() => {
    silenceExpectedConsole('log');
    tree = createTreeWithEmptyWorkspace();
    tree.write('libs/ui/icons.json', JSON.stringify({ icons: ['plus', 'apple'] }));
  });

  it('writes a module augmentation and imports it from the icons file so an app build sees it', async () => {
    await generate(tree, {
      configPath: 'libs/ui/icons.json',
      outputPath: 'libs/ui/src/icons/fa-icons.generated.ts',
      typesOutputPath: 'libs/ui/src/icons/et-icon-registry.generated.d.ts',
      skipFormat: true,
    });

    const types = tree.read('libs/ui/src/icons/et-icon-registry.generated.d.ts', 'utf-8') ?? '';
    const icons = tree.read('libs/ui/src/icons/fa-icons.generated.ts', 'utf-8') ?? '';

    expect(types).toContain(`declare module '@ethlete/components'`);
    expect(types).toContain(`name: 'apple' | 'plus';`);
    expect(types).toMatch(/^export \{\};$/m);
    expect(icons).toContain(`import type {} from './et-icon-registry.generated';`);
  });

  it('imports a types file in another folder by its relative path', async () => {
    await generate(tree, {
      configPath: 'libs/ui/icons.json',
      outputPath: 'libs/ui/src/icons/fa-icons.generated.ts',
      typesOutputPath: 'libs/ui/src/types/registry.d.ts',
      skipFormat: true,
    });

    expect(tree.read('libs/ui/src/icons/fa-icons.generated.ts', 'utf-8')).toContain(
      `import type {} from '../types/registry';`,
    );
  });

  it('defaults the types file next to the icons file', async () => {
    await generate(tree, { configPath: 'libs/ui/icons.json', outputPath: 'libs/ui/icons.ts', skipFormat: true });

    expect(tree.exists('libs/ui/et-icon-registry.d.ts')).toBe(true);
    expect(tree.read('libs/ui/icons.ts', 'utf-8')).toContain(`import type {} from './et-icon-registry';`);
  });
});
