import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { partFilesOf } from '../product';
import { resolveProduct } from '../resolve-product';
import { baselineOf, conflictsOf, partHashOf } from './baseline';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-baseline-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const productDir = (target: string) => join(target, DESIGN_DIR, 'acme');

describe('baselineOf', () => {
  it('hashes each resolved part folder and the fixtures', () => {
    const baseline = baselineOf(resolveAcme(acme()));

    expect(Object.keys(baseline).sort()).toEqual([
      'components/button',
      'components/card',
      'elements/hero',
      'fixtures.ts',
      'foundations/palette',
      'foundations/tokens',
      'pages/home',
    ]);
    expect(baseline['elements/hero']).toMatch(/^[0-9a-f]{16}$/u);
  });

  it("changes a part's hash when an asset it imports or its stylesheet uses changes, and no other part's", () => {
    const target = acme();
    const design = join(target, DESIGN_DIR);

    mkdirSync(join(design, 'acme-base/assets/icons'), { recursive: true });
    writeFileSync(join(design, 'acme-base/assets/icons/dot.svg'), '<svg/>');
    writeFileSync(join(design, 'acme-base/assets/hero.png'), 'one');
    writeFileSync(
      join(productDir(target), 'elements/hero/hero.ts'),
      "import dot from '@assets/icons/dot.svg?raw';\nexport default dot;\n",
    );
    writeFileSync(join(productDir(target), 'elements/hero/hero.css'), ".h { background: url('@assets/hero.png'); }");

    const before = baselineOf(resolveAcme(target));

    writeFileSync(join(design, 'acme-base/assets/icons/dot.svg'), '<svg></svg>');

    const svgChanged = baselineOf(resolveAcme(target));

    expect(svgChanged['elements/hero']).not.toBe(before['elements/hero']);
    expect(svgChanged['pages/home']).toBe(before['pages/home']);

    mkdirSync(join(productDir(target), 'assets'), { recursive: true });
    writeFileSync(join(productDir(target), 'assets/hero.png'), 'two');

    expect(baselineOf(resolveAcme(target))['elements/hero']).not.toBe(svgChanged['elements/hero']);
  });
});

describe('partHashOf with a product shared/ folder', () => {
  it('changes the hash of a part that imports a shared file, through another shared file too, and no other part', () => {
    const target = acme();
    const dir = productDir(target);

    mkdirSync(join(dir, 'shared'), { recursive: true });
    writeFileSync(join(dir, 'shared/sheet.ts'), "export { rows } from './rows';\n");
    writeFileSync(join(dir, 'shared/rows.ts'), 'export const rows = 1;\n');
    writeFileSync(join(dir, 'elements/hero/hero.ts'), "import { rows } from '@shared/sheet';\nexport default rows;\n");

    const before = baselineOf(resolveAcme(target));

    writeFileSync(join(dir, 'shared/rows.ts'), 'export const rows = 2;\n');

    const after = baselineOf(resolveAcme(target));

    expect(after['elements/hero']).not.toBe(before['elements/hero']);
    expect(after['pages/home']).toBe(before['pages/home']);
    expect(after['foundations/tokens']).toBe(before['foundations/tokens']);
  });
});

describe('partHashOf with generated files', () => {
  it('skips a listed file and still hashes the others of the part', () => {
    const target = acme();
    const dir = productDir(target);
    const part = join(dir, 'foundations/palette');
    const generated = 'foundations/palette/palette.css';
    const resolveWith = () => {
      const product = resolveAcme(target);

      return { ...product, config: { ...product.config, generatedFiles: [generated] } };
    };

    writeFileSync(join(part, 'palette.css'), ':root { --a: 1; }\n');

    const before = partHashOf({ product: resolveWith(), dir: part });

    writeFileSync(join(part, 'palette.css'), ':root { --a: 2; }\n');
    expect(partHashOf({ product: resolveWith(), dir: part })).toBe(before);
    expect(partHashOf({ product: resolveAcme(target), dir: part })).not.toBe(before);

    writeFileSync(join(part, 'other.css'), ':root { --b: 1; }\n');
    expect(partHashOf({ product: resolveWith(), dir: part })).not.toBe(before);
  });
});

describe('conflictsOf', () => {
  it('names the parts a variant replaces that changed, came or went in the product', () => {
    const target = acme();
    const baseline = baselineOf(resolveAcme(target));
    const variant = productDir(target);
    const { parts } = partFilesOf(variant);
    const conflicts = () => conflictsOf({ product: resolveAcme(target), baseline, parts, fixtures: true });

    expect(conflicts()).toEqual([]);

    writeFileSync(join(productDir(target), 'elements/hero/hero.css'), '.acme-hero {}');
    rmSync(join(productDir(target), 'pages/home'), { recursive: true });
    writeFileSync(join(productDir(target), 'fixtures.ts'), 'export default {};');

    expect(conflicts()).toEqual(['elements/hero', 'pages/home', 'fixtures.ts']);

    mkdirSync(join(productDir(target), 'components/badge'));
    writeFileSync(join(productDir(target), 'components/badge/badge.ts'), 'export default 1;');

    expect(
      conflictsOf({
        product: resolveAcme(target),
        baseline,
        parts: [{ layer: 'components', name: 'badge', file: join(variant, 'components/badge/badge.ts') }],
        fixtures: false,
      }),
    ).toEqual(['components/badge']);
  });
});
