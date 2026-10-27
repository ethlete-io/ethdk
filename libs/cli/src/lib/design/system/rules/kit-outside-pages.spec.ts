import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { kitOutsidePagesOf } from './kit-outside-pages';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const kitPart = `import { definePart } from '@design-system';
import { box } from '@design-system/kit';
export default definePart({ note: '', states: {}, render: () => ({ body: box(), styles: '' }) });
`;

const rulesOf = (target: string) =>
  kitOutsidePagesOf(resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} })).map(
    (problem) => `${problem.rule} ${problem.message}`,
  );

describe('kitOutsidePagesOf', () => {
  it('lets a page use the kit', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', kitPart);

    expect(rulesOf(target)).toEqual([]);
  });

  it('flags a component and an element that import the kit', () => {
    const target = acme();

    write(target, 'acme/components/button/button.ts', kitPart);
    write(target, 'acme/elements/hero/hero.ts', kitPart);

    expect(rulesOf(target)).toEqual([
      'WIREFRAME-KIT components may not use @design-system/kit - only pages draw with the wireframe kit',
      'WIREFRAME-KIT elements may not use @design-system/kit - only pages draw with the wireframe kit',
    ]);
  });
});
