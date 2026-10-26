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
    expect(classifyImport('@system/fixtures').kind).toBe('fixtures');
    expect(classifyImport('./hero.css?inline').kind).toBe('relative');
    expect(classifyImport('@design-system').kind).toBe('other');
  });
});

describe('importProblemsOf', () => {
  it('passes the clean fixture', () => {
    expect(importProblemsOf(resolveAcme(acme()))).toEqual([]);
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

  it('flags fixtures a product does not have', () => {
    const target = acme();

    write(target, 'acme-base/components/card/card.ts', part("import { films } from '@system/fixtures';"));

    const product = resolveProduct({ target, name: 'acme-base', config: { presets: { a: { width: 1 } } } });

    expect(importProblemsOf(product)).toEqual([
      expect.objectContaining({ message: '@system/fixtures resolves to no fixtures.ts' }),
    ]);
  });
});
