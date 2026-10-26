import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { createSystemModules, fileOfModuleId, productModuleIdOf, productOfModuleId } from './system-modules';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-modules-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return { target, system: createSystemModules({ target, config: readConfig(target) ?? {} }) };
};

describe('createSystemModules', () => {
  it('resolves @system imports inside a base part to the parts of the product that draws it', () => {
    const { target, system } = acme();
    const design = join(target, DESIGN_DIR);
    const card = join(design, 'acme-base/components/card/card.ts');
    const inProduct = (product: string) => productModuleIdOf({ file: card, product });

    expect(system.resolveId('@system/components/button', inProduct('acme'))).toBe(
      productModuleIdOf({ file: join(design, 'acme/components/button/button.ts'), product: 'acme' }),
    );
    expect(system.resolveId('@system/components/button', inProduct('acme-base'))).toBe(
      productModuleIdOf({ file: join(design, 'acme-base/components/button/button.ts'), product: 'acme-base' }),
    );
    expect(system.resolveId('@system/fixtures', inProduct('acme'))).toBe(
      productModuleIdOf({ file: join(design, 'acme/fixtures.ts'), product: 'acme' }),
    );
  });

  it('leaves every other import, and imports from outside a product, to Vite', () => {
    const { target, system } = acme();
    const file = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');
    const hero = productModuleIdOf({ file, product: 'acme' });

    expect(system.resolveId('@system/components/missing', hero)).toBeNull();
    expect(system.resolveId('./hero.css?inline', hero)).toBeNull();
    expect(system.resolveId('@system/components/button', join(target, 'other.ts'))).toBeNull();
    expect(system.resolveId('@system/components/button', productModuleIdOf({ file, product: 'nope' }))).toBeNull();
  });

  it('keeps a resolved product until forget', () => {
    const { target, system } = acme();

    expect(system.partOf({ product: 'acme', part: 'components/badge' })).toBeNull();

    mkdirSync(join(target, DESIGN_DIR, 'acme/components/badge'), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'acme/components/badge/badge.ts'), '');

    expect(system.partOf({ product: 'acme', part: 'components/badge' })).toBeNull();

    system.forget();

    expect(system.partOf({ product: 'acme', part: 'components/badge' })?.origin).toBe('product');
  });

  it('reads the product and the file back out of a module id', () => {
    const id = productModuleIdOf({ file: '/w/a b/x.ts', product: 'acme base' });

    expect(productOfModuleId(id)).toBe('acme base');
    expect(fileOfModuleId(id)).toBe('/w/a b/x.ts');
    expect(productOfModuleId('/w/x.css?inline')).toBeNull();
  });
});
