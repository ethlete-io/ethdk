import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { upwardDependenciesOf } from './upward-dependency';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

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

const rulesOf = (target: string) => upwardDependenciesOf(resolveAcme(target)).map((problem) => problem.message);

describe('upwardDependenciesOf', () => {
  it('passes the clean fixture', () => {
    expect(rulesOf(acme())).toEqual([]);
  });

  it('flags a component that uses an element', () => {
    const target = acme();

    write(target, 'acme/components/button/button.ts', part("import hero from '@system/elements/hero';"));

    expect(rulesOf(target)).toEqual(['components may use foundations, components, not @system/elements/hero']);
  });

  it('flags an element that uses an element, and a page that uses a page', () => {
    const target = acme();

    write(target, 'acme/elements/menu/menu.ts', part("import hero from '@system/elements/hero';"));
    write(target, 'acme/pages/about/about.ts', part("import home from '@system/pages/home';"));

    expect(rulesOf(target)).toEqual([
      'elements may use foundations, components, not @system/elements/hero',
      'pages may use foundations, components, elements, not @system/pages/home',
    ]);
  });

  it('flags a foundation that uses anything', () => {
    const target = acme();

    write(target, 'acme/foundations/palette/palette.ts', part("import button from '@system/components/button';"));

    expect(rulesOf(target)).toEqual(['foundations may use no other layer, not @system/components/button']);
  });
});
