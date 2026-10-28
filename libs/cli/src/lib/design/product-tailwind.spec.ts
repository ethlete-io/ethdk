import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

const fixture = (stylesheet: string) => {
  const root = mkdtempSync(join(__dirname, '__tailwind-'));
  roots.push(root);
  mkdirSync(join(root, 'sketches'));
  writeFileSync(join(root, 'styles.css'), stylesheet);
  writeFileSync(join(root, 'sketches', 'page.ts'), `export const page = '<div class="w-[137px] gap-[11px]"></div>';`);

  return join(root, 'styles.css');
};

const compile = async (file: string) => {
  const { default: postcss } = await import('postcss');
  const { default: tailwind } = await import('@tailwindcss/postcss');

  return (await postcss([tailwind()]).process(readFileSync(file, 'utf8'), { from: file })).css;
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('a product stylesheet that registers its drawing folders', () => {
  it('compiles a utility used only in a sketch file', async () => {
    const css = await compile(fixture(`@import 'tailwindcss' source(none);\n@source './sketches';\n`));

    expect(css).toContain('.w-\\[137px\\]');
    expect(css).toContain('.gap-\\[11px\\]');
  });

  it('leaves the utility out when the folder is not registered', async () => {
    const css = await compile(fixture(`@import 'tailwindcss' source(none);\n`));

    expect(css).not.toContain('.w-\\[137px\\]');
  });
});

describe('the Studio product', () => {
  const root = resolve(__dirname, '../../../../..');
  const config = JSON.parse(readFileSync(join(root, '.ethlete/design/config.json'), 'utf8'));

  it('loads a stylesheet that registers the drawing folders', () => {
    const [sheet] = config.products.studio.styles ?? [];

    expect(sheet).toBeDefined();
    expect(existsSync(join(root, sheet))).toBe(true);
    expect(readFileSync(join(root, sheet), 'utf8')).toMatch(/@source/);
  });
});
