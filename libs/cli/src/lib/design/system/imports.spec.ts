import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { classifyImport, importProblemsOf } from './imports';
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

  it('flags @shared/ outside a sketch variant and passes it inside one', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part("import { data } from '@shared/data';"));

    expect(importProblemsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({ rule: 'IMPORT', message: expect.stringContaining('only a part in a sketch variant') }),
    ]);
    expect(importProblemsOf({ ...resolveAcme(target), sharedDir: join(target, 'shared') })).toEqual([]);
    expect(classifyImport('@shared/data/list')).toEqual({
      kind: 'shared',
      path: 'data/list',
      specifier: '@shared/data/list',
    });
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
