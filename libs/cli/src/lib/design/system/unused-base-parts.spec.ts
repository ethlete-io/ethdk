import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { resolveProduct } from './resolve-product';
import { unusedBasePartsOf } from './unused-base-parts';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-unused-base-parts-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, path)), { recursive: true });
  writeFileSync(join(target, path), content);
};

const unusedOf = (target: string) => [
  ...unusedBasePartsOf(resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} })),
];

const basePart = (target: string, key: string, imports: string) =>
  write(
    target,
    `${DESIGN_DIR}/acme-base/${key}/${key.split('/')[1]}.ts`,
    `${imports}import { definePart, drawing, html } from '@design-system';\nexport default definePart({ note: '', states: { rest: drawing(() => html\`<i></i>\`) } });\n`,
  );

describe('unusedBasePartsOf', () => {
  it('counts a base part a page imports and the base token part as used', () => {
    expect(unusedOf(acme())).toEqual([]);
  });

  it('lists a base part once no part of the product imports it', () => {
    const target = acme();
    const home = `${DESIGN_DIR}/acme/pages/home/home.ts`;

    write(target, home, readFileSync(join(target, home), 'utf8').replace(/^import card .*$/mu, 'const card = hero;'));

    expect(unusedOf(target)).toEqual(['components/card']);
  });

  it('counts a base part as used when a product part imports its same-named SDK design module', () => {
    const target = acme();
    const hero = `${DESIGN_DIR}/acme/elements/hero/hero.ts`;

    write(target, 'libs/components/design/badge.ts', "export * from './icon';\n");
    write(target, 'libs/components/design/icon.ts', 'export const icon = 1;\n');
    write(target, 'libs/components/design/chip.ts', 'export const chip = 1;\n');
    basePart(target, 'components/badge', "import '@ethlete/components/design/badge';\n");
    basePart(target, 'components/icon', "import '@ethlete/components/design/icon';\n");
    basePart(
      target,
      'components/chip',
      "import '@ethlete/components/design/chip';\nimport '@ethlete/components/design/badge';\n",
    );
    write(target, hero, `import '@ethlete/components/design/badge';\n${readFileSync(join(target, hero), 'utf8')}`);

    expect(unusedOf(target)).toEqual(['components/chip']);
  });
});
