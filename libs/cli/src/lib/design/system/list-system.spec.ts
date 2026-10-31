import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { createDesignServer } from '../serve';
import { gridReportOf, listSystem } from './list-system';
import { resolveProduct } from './resolve-product';
import { createSketch, variantDirOf } from './sketch/sketch';
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
  it("lists each part's origin, note and states, and the product's presets and schemes", async () => {
    const [product] = await list(acme(), ['acme']);

    expect(product).toMatchObject({
      name: 'acme',
      base: '.ethlete/design/acme-base',
      presets: { phone: { width: 390, height: 844 }, desktop: { width: 1280 } },
      schemes: ['light', 'dark'],
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

  it('lists the pages that use a part through the import graph, also in a product that draws it as its base part', async () => {
    const [base, product] = await list(acme(), ['acme-base', 'acme']);
    const usedIn = (listed: typeof product, key: string) =>
      listed?.parts.find((part) => `${part.layer}/${part.name}` === key)?.usedIn;
    const home = [{ product: 'acme', part: 'pages/home' }];

    expect(usedIn(product, 'elements/hero')).toEqual(home);
    expect(usedIn(product, 'components/button')).toEqual(home);
    expect(usedIn(product, 'foundations/palette')).toEqual([]);
    expect(usedIn(product, 'pages/home')).toEqual([]);
    expect(usedIn(base, 'components/card')).toEqual(home);
    expect(usedIn(base, 'components/button')).toEqual([]);
  });

  it('lists the tokens part as used by every page of each product that draws under it, though no page imports it', async () => {
    const [base, product] = await list(acme(), ['acme-base', 'acme']);
    const tokens = (listed: typeof product) =>
      listed?.parts.find((part) => `${part.layer}/${part.name}` === 'foundations/tokens')?.usedIn;

    expect(tokens(product)).toEqual([{ product: 'acme', part: 'pages/home' }]);
    expect(tokens(base)).toEqual([{ product: 'acme', part: 'pages/home' }]);
  });

  it('lists every part a product names as tokens as used by its pages, and skips a named part that does not exist', async () => {
    const target = acme();
    const configFile = join(target, DESIGN_DIR, 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));

    config.products.acme.tokens = ['foundations/tokens', 'foundations/missing', 'foundations/palette'];
    writeFileSync(configFile, JSON.stringify(config));

    const [product] = await list(target, ['acme']);
    const usedIn = (part: string) => product?.parts.find((listed) => `${listed.layer}/${listed.name}` === part)?.usedIn;

    expect(usedIn('foundations/tokens')).toEqual([{ product: 'acme', part: 'pages/home' }]);
    expect(usedIn('foundations/palette')).toEqual([{ product: 'acme', part: 'pages/home' }]);
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

  it("lists a part's widths when they are a list of positive numbers, and a WIDTHS problem when they are not", async () => {
    const target = acme();
    const withWidths = (path: string, widths: string) => {
      const file = join(target, DESIGN_DIR, path);

      writeFileSync(file, readFileSync(file, 'utf8').replace('  states:', `  widths: ${widths},\n  states:`));
    };

    withWidths('acme/elements/hero/hero.ts', '[320, 640]');
    withWidths('acme/foundations/palette/palette.ts', '[]');

    const [product] = await list(target, ['acme']);
    const partOf = (name: string) => product?.parts.find((part) => part.name === name);

    expect(partOf('hero')?.widths).toEqual([320, 640]);
    expect(partOf('hero')?.problems).toEqual([]);
    expect(partOf('palette')).not.toHaveProperty('widths');
    expect(partOf('palette')?.problems).toEqual([expect.objectContaining({ rule: 'WIDTHS' })]);
    expect(partOf('button')).not.toHaveProperty('widths');
  });

  it("lists a part's motions without their play", async () => {
    const target = acme();
    const file = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(
        '  states:',
        "  motions: { fold: { from: 'default', to: 'default', at: [100], play: () => undefined } },\n  states:",
      ),
    );

    const [product] = await list(target, ['acme']);

    expect(product?.parts.find((part) => part.name === 'hero')?.motions).toEqual({
      fold: { from: 'default', to: 'default', at: [100] },
    });
    expect(product?.parts.find((part) => part.name === 'palette')).not.toHaveProperty('motions');
  });

  it("lists a part's known interactions once each, and an INTERACTIONS problem for an unknown one", async () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace('  states:', "  interactions: ['hover', 'pressed', 'hover'],\n  states:"),
    );

    const [product] = await list(target, ['acme']);
    const partOf = (name: string) => product?.parts.find((part) => part.name === name);

    expect(partOf('button')?.interactions).toEqual(['hover', 'focus-visible', 'active', 'disabled']);
    expect(partOf('palette')?.interactions).toEqual([]);
    expect(partOf('hero')?.interactions).toEqual(['hover']);
    expect(partOf('hero')?.problems).toEqual([expect.objectContaining({ rule: 'INTERACTIONS' })]);
  });

  it("lists the cells of a part's grid that name a known state, each state once, and no grid without one", async () => {
    const target = acme();

    write(
      target,
      'acme/components/row/row.ts',
      `import { definePart, drawing } from '@design-system';
export default definePart({
  note: '',
  states: { leaf: {}, hover: {}, selected: {}, tree: {} },
  grid: {
    columns: ['rest', 'hover'],
    rows: { leaf: { rest: 'leaf', hover: 'hover' }, selected: { rest: 'selected', hover: 'leaf' }, gone: { rest: 'missing' as 'leaf' } },
  },
  render: () => drawing({ body: '<div>row</div>', styles: '' }),
});
`,
    );

    const [product] = await list(target, ['acme']);
    const partOf = (name: string) => product?.parts.find((part) => part.name === name);

    expect(partOf('row')?.grid).toEqual({
      columns: ['rest', 'hover'],
      rows: ['leaf', 'selected'],
      cells: [
        { row: 'leaf', column: 'rest', state: 'leaf' },
        { row: 'leaf', column: 'hover', state: 'hover' },
        { row: 'selected', column: 'rest', state: 'selected' },
      ],
    });
    expect(partOf('row')?.problems).toEqual([]);
    expect(partOf('button')).not.toHaveProperty('grid');
  });

  it('counts the wireframe kit calls of a page and loads the page through the kit', async () => {
    const target = acme();

    write(
      target,
      'acme/pages/login/login.ts',
      `import { definePart, drawing } from '@design-system';
import { box, button, input } from '@design-system/kit';
export default definePart({ note: '', states: { rest: {} }, render: () => drawing({ body: box([input(), button('Go')]), styles: '' }) });
`,
    );

    const [product] = await list(target, ['acme']);
    const kitUses = Object.fromEntries(
      product?.parts.map((part) => [`${part.layer}/${part.name}`, part.kitUses]) ?? [],
    );

    expect(kitUses).toMatchObject({ 'pages/home': 0, 'pages/login': 3, 'components/button': 0 });
    expect(product?.parts.find((part) => part.name === 'login')?.problems).toEqual([]);
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

  it('draws a page with the element a sketch variant holds in place of the merged element', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};
    const created = createSketch({
      product: resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} }),
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    });

    if (typeof created === 'string') throw new Error(created);

    const hero = join(variantDirOf(created, 'a'), 'elements/hero/hero.ts');

    writeFileSync(hero, readFileSync(hero, 'utf8').replace('<h1>', '<h1 class="variant-a">'));

    const vite = await createDesignServer({ target, config, listen: false });

    closing.push(() => vite.close());

    const system = createSystemModules({ target, config });
    const drawHome = async (sketch: { target: string; variant: string } | null) => {
      const file = system.partOf({ product: 'acme', part: 'pages/home', sketch })?.file ?? '';
      const loaded = (await vite.ssrLoadModule(productModuleIdOf({ file, product: 'acme', sketch }))) as {
        default: { render: (props: { films: [] }) => Promise<{ body: string }> };
      };

      return (await loaded.default.render({ films: [] })).body;
    };

    expect(await drawHome({ target: 'elements/hero', variant: 'a' })).toContain('<h1 class="variant-a">');
    expect(await drawHome(null)).not.toContain('variant-a');
  });

  it('serves the CSS a part imports with its interactions forceable', async () => {
    const target = acme();

    writeFileSync(
      join(target, DESIGN_DIR, 'acme/components/button/button.css'),
      '.acme-button:hover { opacity: 0.8; }',
    );

    const config = readConfig(target) ?? {};
    const vite = await createDesignServer({ target, config, listen: false });

    closing.push(() => vite.close());

    const button = createSystemModules({ target, config }).partOf({ product: 'acme', part: 'components/button' });
    const loaded = (await vite.ssrLoadModule(productModuleIdOf({ file: button?.file ?? '', product: 'acme' }))) as {
      default: { render: (props: { label: string }) => { styles: string } };
    };

    expect(loaded.default.render({ label: 'x' }).styles).toContain('.acme-button:is(:hover, [data-et-force~="hover"])');
  });
});

describe('gridReportOf', () => {
  it('sums up a grid, names a state it leaves out, and fails a state named twice or no state at all', () => {
    const states = ['a', 'b', 'c', 'd'];

    expect(gridReportOf(undefined, states)).toBeNull();
    expect(
      gridReportOf({ columns: ['x', 'y'], rows: { r1: { x: 'a', y: 'b' }, r2: { x: 'c', y: 'd' } } }, states),
    ).toEqual({
      line: 'grid 2 rows x 2 columns ok',
      problems: [],
      warnings: [],
    });
    expect(
      gridReportOf({ columns: ['x', 'y'], rows: { r1: { x: 'a', y: 'a' }, r2: { x: 'b', y: 'gone' } } }, states),
    ).toEqual({
      line: 'grid 2 rows x 2 columns, leaves out c, d',
      problems: ['grid names the state a twice (r1 x, r1 y)', 'grid cell r2 y names gone, which is no state'],
      warnings: [],
    });
  });

  it('names each empty cell of a row that draws a state in another column', () => {
    expect(
      gridReportOf(
        { columns: ['rest', 'active'], rows: { row: { rest: 'a', active: 'b' }, selected: { rest: 'c' }, none: {} } },
        ['a', 'b', 'c', 'd'],
      )?.line,
    ).toBe('grid 3 rows x 2 columns, leaves out d; draws no selected active');
  });

  it('warns of rows that fill some interaction columns but skip others, and leaves rest-only rows alone', () => {
    const states = ['face', 'face-hover', 'face-focus', 'count', 'count-hover', 'badge', 'mark'];
    const grid = (rows: Record<string, Record<string, string>>) => ({
      columns: ['rest', 'hover', 'focus-visible'],
      rows,
    });

    expect(
      gridReportOf(
        grid({
          face: { rest: 'face', hover: 'face-hover', 'focus-visible': 'face-focus' },
          count: { rest: 'count', hover: 'count-hover' },
          badge: { rest: 'badge' },
          mark: { rest: 'mark' },
        }),
        states,
      )?.warnings,
    ).toEqual(['grid row count leaves out focus-visible, which face fills - a state can break there unseen']);
    expect(gridReportOf(grid({ badge: { rest: 'badge' }, mark: { rest: 'mark' } }), states)?.warnings).toEqual([]);
    expect(
      gridReportOf(
        { columns: ['light', 'dark'], rows: { r1: { light: 'face', dark: 'mark' }, r2: { light: 'badge' } } },
        states,
      )?.warnings,
    ).toEqual([]);
  });
});
