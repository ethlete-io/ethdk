import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { LOGO_ROOTS, PRODUCT_LOGO_RULE, productLogoOf } from './product-logo';

const FILE = '/p/.ethlete/design/config.json';

const run = (logo: string | undefined, files: string[] = []) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-product-logo-'));

  for (const file of files) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), 'x');
  }

  return productLogoOf({ target, file: FILE, config: { products: { app: logo === undefined ? {} : { logo } } } });
};

describe('productLogoOf', () => {
  it('passes a product without a logo', () => {
    expect(run(undefined)).toEqual([]);
  });

  it('passes an svg under a design assets folder', () => {
    const logo = '.ethlete/design/app/assets/icon.svg';

    expect(run(logo, [logo])).toEqual([]);
  });

  it('passes a png under a tauri icons folder', () => {
    const logo = 'apps/app/src-tauri/icons/128x128.png';

    expect(run(logo, [logo])).toEqual([]);
  });

  it('fails a missing file', () => {
    const problems = run('.ethlete/design/app/assets/icon.svg');

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ rule: PRODUCT_LOGO_RULE, file: FILE });
    expect(problems[0]?.message).toContain('products.app.logo');
    expect(problems[0]?.message).toContain('does not exist');
  });

  it('fails another extension', () => {
    const logo = '.ethlete/design/app/assets/icon.jpg';

    expect(run(logo, [logo])[0]?.message).toContain('not an svg or png');
  });

  it('fails a file outside the roots', () => {
    const logo = 'docs/icon.svg';

    expect(run(logo, [logo])[0]?.message).toContain('outside the folders');
  });

  it('fails an svg in tauri icons, which the rail only loads as png', () => {
    const logo = 'apps/app/src-tauri/icons/icon.svg';

    expect(run(logo, [logo])[0]?.message).toContain('outside the folders');
  });
});

describe('LOGO_ROOTS', () => {
  it('matches the globs of the shell-main part', () => {
    const root = resolve(__dirname, '../../../../../../..');
    const shared = join(root, '.ethlete/design/studio/elements/shell-main/shared');
    const source = readFileSync(join(shared, 'shell-main.ts'), 'utf8');
    const block = /LOGO_FILES = import\.meta\.glob<string>\(\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '';
    const globs = [...block.matchAll(/'([^']+)'/g)].map((match) => {
      const parts = (match[1] ?? '').split('/');
      const ups = parts.filter((part) => part === '..').length;
      const base = shared.split('/').slice(0, -ups).join('/');

      return join(base, ...parts.filter((part) => part !== '..')).slice(root.length + 1);
    });

    expect(globs).toEqual(LOGO_ROOTS);
  });
});
