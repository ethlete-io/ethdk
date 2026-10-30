import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { classifyImport, importProblemsOf, sharedFileOf } from './imports';
import { resolveProduct } from './resolve-product';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const part = (body: string) =>
  `import { definePart } from '@design-system';\n${body}\nexport default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });\n`;

describe('classifyImport', () => {
  it('tells parts, fixtures, relative and other imports apart', () => {
    expect(classifyImport('@system/components/button')).toEqual({
      kind: 'part',
      layer: 'components',
      name: 'button',
      specifier: '@system/components/button',
    });
    expect(classifyImport('@system/foundations/tokens.css?inline')).toEqual({
      kind: 'part',
      layer: 'foundations',
      name: 'tokens',
      specifier: '@system/foundations/tokens.css?inline',
      stylesheet: true,
    });
    expect(classifyImport('@system/fixtures').kind).toBe('fixtures');
    expect(classifyImport('./hero.css?inline').kind).toBe('relative');
    expect(classifyImport('@design-system').kind).toBe('other');
  });
});

describe('importProblemsOf', () => {
  it('passes the clean fixture', () => {
    expect(importProblemsOf(resolveAcme(acme()))).toEqual([]);
  });

  it("resolves @shared/ outside a sketch variant to the product's shared folder, and inside one to the sketch's too", () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part("import { data } from '@shared/data';"));

    expect(importProblemsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({
        rule: 'IMPORT',
        message: "@shared/data resolves to no file in the product's shared/ folder",
      }),
    ]);
    write(target, 'acme/shared/data.ts', 'export const data = 1;\n');
    expect(importProblemsOf(resolveAcme(target))).toEqual([]);
    rmSync(join(target, DESIGN_DIR, 'acme/shared'), { recursive: true });
    mkdirSync(join(target, 'shared'));
    writeFileSync(join(target, 'shared/data.ts'), 'export const data = 1;\n');
    expect(importProblemsOf({ ...resolveAcme(target), sharedDir: join(target, 'shared') })).toEqual([]);
    expect(classifyImport('@shared/data/list')).toEqual({
      kind: 'shared',
      path: 'data/list',
      specifier: '@shared/data/list',
    });
  });

  it("resolves @shared/ to the variant's own copy first, then to the sketch's", () => {
    const target = acme();
    const [variant, sketch] = [join(target, 'a/shared'), join(target, 'shared')];

    [variant, sketch].forEach((dir) => mkdirSync(dir, { recursive: true }));
    writeFileSync(join(sketch, 'pin.ts'), '');
    writeFileSync(join(sketch, 'list.ts'), '');
    writeFileSync(join(variant, 'pin.ts'), '');

    expect(sharedFileOf({ dirs: [variant, sketch], path: 'pin' })).toBe(join(variant, 'pin.ts'));
    expect(sharedFileOf({ dirs: [variant, sketch], path: 'list' })).toBe(join(sketch, 'list.ts'));
  });

  it('flags an @shared/ import whose file the shared folder lacks', () => {
    const target = acme();
    const shared = join(target, 'shared');

    mkdirSync(join(shared, 'list'), { recursive: true });
    writeFileSync(join(shared, 'list/index.ts'), '');
    writeFileSync(join(shared, 'pin.css'), '');
    write(
      target,
      'acme/elements/hero/hero.ts',
      part(
        "import { logo } from '@shared/agent-logos';\nimport { list } from '@shared/list';\nimport pin from '@shared/pin.css?inline';\nimport gone from '@shared/gone.css?inline';",
      ),
    );

    expect(importProblemsOf({ ...resolveAcme(target), sharedDir: shared }).map(({ message }) => message)).toEqual([
      "@shared/agent-logos resolves to no file in the variant's, the sketch's or the product's shared/ folder",
      "@shared/gone.css?inline resolves to no file in the variant's, the sketch's or the product's shared/ folder",
    ]);
  });

  it('flags an @assets/ import or stylesheet url() with no file, and finds one in the base or the variant', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.ts',
      part("import mark from '@assets/mark.png';\nimport dot from '@assets/icons/dot.svg?raw';"),
    );
    write(target, 'acme/elements/hero/hero.css', ".acme-hero { background: url('@assets/hero.webp'); }");

    expect(importProblemsOf(resolveAcme(target)).map((problem) => problem.message)).toEqual([
      'url(@assets/hero.webp) resolves to no file in an assets/ folder',
      '@assets/mark.png resolves to no file in an assets/ folder',
      '@assets/icons/dot.svg?raw resolves to no file in an assets/ folder',
    ]);

    write(target, 'acme-base/assets/mark.png', 'png');
    write(target, 'acme/assets/icons/dot.svg', '<svg/>');
    write(target, 'variant/assets/hero.webp', 'webp');

    expect(importProblemsOf({ ...resolveAcme(target), assetsDir: join(target, DESIGN_DIR, 'variant/assets') })).toEqual(
      [],
    );
    expect(classifyImport('@assets/icons/dot.svg?raw')).toEqual({
      kind: 'asset',
      path: 'icons/dot.svg',
      specifier: '@assets/icons/dot.svg?raw',
    });
  });

  it('flags a relative import into another part', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part("import button from '../../components/button/button';"));

    expect(importProblemsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({
        rule: 'IMPORT',
        message: expect.stringContaining('import another part as @system/<layer>/<name>'),
      }),
    ]);
  });

  it('flags a part name that resolves to no part', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part("import badge from '@system/components/badge';"));

    expect(importProblemsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({ message: '@system/components/badge resolves to no part' }),
    ]);
  });

  it('flags a stylesheet import of a part without its own stylesheet, and passes one that has it', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.ts',
      part(
        "import tokens from '@system/foundations/tokens.css?inline';\nimport home from '@system/pages/home.css?inline';",
      ),
    );

    expect(importProblemsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({ message: '@system/pages/home.css?inline resolves to a part without home.css' }),
    ]);
  });

  it('flags fixtures a product does not have', () => {
    const target = acme();

    write(target, 'acme-base/components/card/card.ts', part("import { films } from '@system/fixtures';"));

    const product = resolveProduct({ target, name: 'acme-base', config: { presets: { a: { width: 1 } } } });

    expect(importProblemsOf(product)).toEqual([
      expect.objectContaining({ message: '@system/fixtures resolves to no fixtures.ts' }),
    ]);
  });
});
