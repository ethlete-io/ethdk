import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { createDesignServer } from '../serve';
import { listSystem } from './list-system';
import { createSystemModules, productModuleIdOf } from './system-modules';

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-list-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const list = async (target: string, products: string[]) => {
  const config = readConfig(target) ?? {};
  const vite = await createDesignServer({ target, config, listen: false });

  closing.push(() => vite.close());

  return listSystem({
    target,
    system: createSystemModules({ target, config }),
    products,
    load: ({ file, product }) => vite.ssrLoadModule(productModuleIdOf({ file, product })),
  });
};

describe('listSystem', () => {
  it("lists each part's origin, note and states, and the product's presets", async () => {
    const [product] = await list(acme(), ['acme']);

    expect(product).toMatchObject({
      name: 'acme',
      base: '.ethlete/design/acme-base',
      presets: { phone: { width: 390, height: 844 }, desktop: { width: 1280 } },
      themes: { surface: [], color: [] },
      problems: [],
    });
    expect(product?.parts.map(({ layer, name, origin, states }) => [`${layer}/${name}`, origin, states])).toEqual([
      ['foundations/palette', 'product', ['default']],
      ['foundations/tokens', 'base', ['accent']],
      ['components/button', 'overridden', ['default', 'long']],
      ['components/card', 'base', ['default', 'long']],
      ['elements/hero', 'product', ['default']],
      ['pages/home', 'product', ['default', 'empty']],
    ]);
    expect(product?.parts.find((part) => part.name === 'button')?.note).toBe(
      'Pill shape, because Acme rounds every action.',
    );
    expect(product?.parts.every((part) => part.problems.length === 0)).toBe(true);
  });

  it("lists each product's own theme names, not its base's", async () => {
    const target = acme();
    const file = join(target, DESIGN_DIR, 'config.json');
    const config = readConfig(target) ?? {};

    writeFileSync(
      file,
      JSON.stringify({
        products: {
          'acme-base': { ...config.products?.['acme-base'], themes: { surface: ['base-light'], color: ['base'] } },
          acme: { ...config.products?.['acme'], themes: { surface: ['light', 'dark'] } },
        },
      }),
    );

    const products = await list(target, ['acme', 'acme-base']);

    expect(products.map(({ name, themes }) => [name, themes])).toEqual([
      ['acme', { surface: ['light', 'dark'], color: [] }],
      ['acme-base', { surface: ['base-light'], color: ['base'] }],
    ]);
  });

  it('puts a rule problem and a load error on the part they belong to', async () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.css', '.acme-hero { color: #ff0000; }\n');
    write(target, 'acme/elements/broken/broken.ts', "throw new Error('broken on load');\n");

    const [product] = await list(target, ['acme']);
    const problemsOf = (name: string) => product?.parts.find((part) => part.name === name)?.problems ?? [];

    expect(problemsOf('hero')).toEqual([
      expect.objectContaining({ rule: 'HARD-CODED-COLOUR', file: '.ethlete/design/acme/elements/hero/hero.css' }),
    ]);
    expect(problemsOf('broken')).toEqual([
      expect.objectContaining({ rule: 'LOAD', message: expect.stringContaining('broken on load') }),
    ]);
    expect(problemsOf('home')).toEqual([]);
  });

  it('loads a base part with the parts of the product that uses it', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};
    const vite = await createDesignServer({ target, config, listen: false });

    closing.push(() => vite.close());

    const system = createSystemModules({ target, config });
    const card = system.partOf({ product: 'acme', part: 'components/card' })?.file ?? '';
    const drawCard = async (product: string) => {
      const loaded = (await vite.ssrLoadModule(productModuleIdOf({ file: card, product }))) as {
        default: { render: (props: { title: string }) => Promise<{ styles: string }> };
      };

      return (await loaded.default.render({ title: 'x' })).styles;
    };

    expect(await drawCard('acme')).toContain('border-radius: 999px');
    expect(await drawCard('acme-base')).not.toContain('border-radius');
  });
});
