import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { writeCallsTsconfig } from '../calls-tsconfig';
import { DESIGN_DIR, readConfig } from '../paths';
import { resolveProduct } from './resolve-product';
import { writeEditorTsconfig, writeSystemTsconfig } from './system-tsconfig';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-editor-tsconfig-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

describe('editor tsconfigs', () => {
  it('writes the product tsconfig next to its parts', () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

    writeEditorTsconfig({ target, product });

    const config = JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/tsconfig.json'), 'utf8'));

    expect(Object.keys(config.compilerOptions.paths)).toContain('@design-system');
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

  it('writes the calls tsconfig into the design folder', () => {
    const target = acme();

    writeCallsTsconfig(target);

    expect(existsSync(join(target, DESIGN_DIR, 'tsconfig.json'))).toBe(true);
  });
});
