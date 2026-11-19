import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { silenceExpectedConsole } from '../../src/lib/testing/expected-console';
import generate from './generator';

const ICONS_YML = `xmark:
  aliases:
    names:
      - close
      - times
    unicodes:
      composite:
        - '2715'
  search:
    terms: []
'0':
  aliases:
    unicodes:
      secondary:
        - '10f0'
`;

const SVG_FILES = ['solid/plus.svg', 'solid/apple.svg', 'solid/xmark.svg'];

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: (path: string) =>
    path.endsWith('fontawesome-free/svgs') ||
    path.endsWith('fontawesome-free/metadata/icons.yml') ||
    SVG_FILES.some((file) => path.endsWith(`fontawesome-free/svgs/${file}`)),
  readFileSync: (path: string) =>
    path.endsWith('icons.yml')
      ? ICONS_YML
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="${path.split('/').pop()}"/></svg>`,
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

  it('emits the canonical svg under an alias name the package ships no file for', async () => {
    silenceExpectedConsole('warn');
    tree.write('libs/ui/icons.json', JSON.stringify({ icons: ['times', 'unknown'] }));

    await generate(tree, { configPath: 'libs/ui/icons.json', outputPath: 'libs/ui/icons.ts', skipFormat: true });

    const icons = tree.read('libs/ui/icons.ts', 'utf-8') ?? '';

    expect(icons).toContain('TIMES_SOLID');
    expect(icons).toContain('xmark.svg');
    expect(icons).not.toContain('UNKNOWN_SOLID');
    expect(tree.read('libs/ui/et-icon-registry.d.ts', 'utf-8')).toContain(`name: 'times';`);
  });
});
