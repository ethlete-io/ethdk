import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { writeCallsTsconfig } from '../calls-tsconfig';
import { DESIGN_DIR, readConfig } from '../design-config';
import { resolveProduct } from './resolve-product';
import { createSketch, Sketch } from './sketch/sketch';
import { repairEditorTsconfigs, writeEditorTsconfig, writeSystemTsconfig } from './system-tsconfig';

const running = vi.hoisted(() => ({ root: null as string | null }));

vi.mock('../package-root', async (original) => {
  const actual = await original<typeof import('../package-root')>();

  return {
    ...actual,
    installedAssetRoot: () => running.root ?? actual.installedAssetRoot(),
    editorAssetRootOf: (target: string) => actual.editorAssetRootOf(target, running.root ?? undefined),
  };
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-editor-tsconfig-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const editorConfigOf = (target: string) =>
  JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/tsconfig.json'), 'utf8')) as {
    compilerOptions: { paths: Record<string, string[]> };
    include: string[];
  };

const withRunningRoot = (root: string, run: () => void) => {
  mkdirSync(root, { recursive: true });
  running.root = root;

  try {
    run();
  } finally {
    running.root = null;
  }
};

describe('editor tsconfigs', () => {
  it('writes the product tsconfig next to its parts', () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

    writeEditorTsconfig({ target, product });

    const config = JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/tsconfig.json'), 'utf8'));

    expect(Object.keys(config.compilerOptions.paths)).toContain('@design-system');
  });

  it('leaves an unchanged editor tsconfig untouched, so the server does not reload every frame', () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const productConfig = join(target, DESIGN_DIR, 'acme/tsconfig.json');
    const callsConfig = join(target, DESIGN_DIR, 'tsconfig.json');

    writeEditorTsconfig({ target, product });
    writeCallsTsconfig(target);
    utimesSync(productConfig, 0, 0);
    utimesSync(callsConfig, 0, 0);
    writeEditorTsconfig({ target, product });
    writeCallsTsconfig(target);

    expect(statSync(productConfig).mtimeMs).toBe(0);
    expect(statSync(callsConfig).mtimeMs).toBe(0);
  });

  it("maps @shared/* to a sketch's shared folder and includes its files", () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sharedDir = join(target, 'sketch/shared');
    const config = JSON.parse(
      readFileSync(writeSystemTsconfig({ target, product: { ...product, sharedDir } }), 'utf8'),
    );

    expect(config.compilerOptions.paths['@shared/*']).toEqual([join(sharedDir, '*')]);
    expect(config.include).toContain(join(sharedDir, '**/*.ts'));
  });

  it("maps @shared/* to the product's shared folder after a sketch's, once the folder exists", () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const productShared = join(product.dir, 'shared');
    const sharedDir = join(target, 'sketch/shared');
    const pathsOf = () =>
      JSON.parse(readFileSync(writeSystemTsconfig({ target, product: { ...product, sharedDir } }), 'utf8'))
        .compilerOptions.paths['@shared/*'];

    expect(pathsOf()).toEqual([join(sharedDir, '*')]);
    mkdirSync(productShared);
    expect(pathsOf()).toEqual([join(sharedDir, '*'), join(productShared, '*')]);
  });

  it('writes the calls tsconfig into the design folder', () => {
    const target = acme();

    writeCallsTsconfig(target);

    expect(existsSync(join(target, DESIGN_DIR, 'tsconfig.json'))).toBe(true);
  });

  it('keeps the editor tsconfig when the CLI runs from a temporary build', () => {
    const target = acme();
    const product = resolveAcme(target);

    writeEditorTsconfig({ target, product });
    const before = readFileSync(join(target, DESIGN_DIR, 'acme/tsconfig.json'), 'utf8');

    withRunningRoot(join(target, 'tmp/cli-build/design'), () => writeEditorTsconfig({ target, product }));
    withRunningRoot(join(tmpdir(), 'cli-build/design'), () => writeEditorTsconfig({ target, product }));

    expect(readFileSync(join(target, DESIGN_DIR, 'acme/tsconfig.json'), 'utf8')).toBe(before);
    expect(existsSync(editorConfigOf(target).compilerOptions.paths['@design-system']?.[0] ?? '')).toBe(true);
  });

  it('maps @design-system to the @ethlete/cli the checkout installs', () => {
    const target = acme();
    const installed = join(target, 'node_modules/@ethlete/cli/design');

    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'define-part.ts'), '');
    withRunningRoot(join(target, 'tmp/cli-build/design'), () =>
      writeEditorTsconfig({ target, product: resolveAcme(target) }),
    );

    expect(editorConfigOf(target).compilerOptions.paths['@design-system']).toEqual([
      realpathSync(join(installed, 'define-part.ts')),
    ]);
  });

  it('repairs an editor tsconfig whose @design-system file is gone', () => {
    const target = acme();
    const path = join(target, DESIGN_DIR, 'acme/tsconfig.json');

    writeEditorTsconfig({ target, product: resolveAcme(target) });
    const good = readFileSync(path, 'utf8');
    const live = editorConfigOf(target).compilerOptions.paths['@design-system']?.[0] ?? '';

    writeFileSync(path, good.replaceAll(join(live, '..'), join(target, 'tmp/gone/design')));
    repairEditorTsconfigs(target);

    expect(readFileSync(path, 'utf8')).toBe(good);
  });

  it('gives each sketch variant an editor tsconfig with the paths of its typecheck', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    mkdirSync(join(sketch.dir, 'b/components/card'), { recursive: true });
    writeFileSync(join(sketch.dir, 'b/components/card/card.ts'), "export default 'card b';");
    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/chrome.ts'), 'export const chrome = 1;');
    writeEditorTsconfig({ target, product: resolveAcme(target) });

    const configOf = (dir: string) => JSON.parse(readFileSync(join(sketch.dir, dir, 'tsconfig.json'), 'utf8'));

    expect(configOf('.').include).toContain(join(sketch.dir, 'shared/**/*.ts'));
    expect(configOf('a').include).toContain(join(sketch.dir, 'a/**/*.ts'));
    expect(configOf('a').compilerOptions.paths['@system/components/card']).not.toEqual([
      join(sketch.dir, 'b/components/card/card.ts'),
    ]);
    expect(configOf('b').compilerOptions.paths['@system/components/card']).toEqual([
      join(sketch.dir, 'b/components/card/card.ts'),
    ]);
    expect(configOf('b').compilerOptions.paths['@shared/*'].slice(0, 2)).toEqual([
      join(sketch.dir, 'b/shared/*'),
      join(sketch.dir, 'shared/*'),
    ]);
    expect(existsSync(configOf('b').compilerOptions.paths['@design-system'][0])).toBe(true);
  });
});
