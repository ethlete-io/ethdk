import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../paths';
import { resolveProduct } from './resolve-product';
import { writeSystemTsconfig } from './system-tsconfig';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

describe('writeSystemTsconfig', () => {
  it('maps each part name to the part the product resolves', () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const config = JSON.parse(readFileSync(writeSystemTsconfig({ target, product }), 'utf8')) as {
      compilerOptions: { paths: Record<string, string[]> };
      include: string[];
    };
    const { paths } = config.compilerOptions;

    expect(paths['@system/components/button']?.[0]).toContain('/acme/components/button/button.ts');
    expect(paths['@system/components/card']?.[0]).toContain('/acme-base/components/card/card.ts');
    expect(paths['@system/fixtures']?.[0]).toContain('/acme/fixtures.ts');
    expect(paths['@design-system']?.[0]).toMatch(/define-part\.ts$/);
    expect(config.include).not.toContainEqual(expect.stringContaining('/acme-base/components/button/'));
    expect(config.include).toContainEqual(expect.stringContaining('/acme-base/components/card/card.ts'));
  });
});
