import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createSketch, Sketch, variantDirOf } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const MERGED = '#e4572e';
const SKETCHED = '#13579b';

const serveAcme = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-styles-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const styles = join(target, DESIGN_DIR, 'acme/styles.css');
  const config = readConfig(target) ?? {};
  const acme = config.products?.['acme'] ?? {};

  writeFileSync(styles, "@import './foundations/palette/palette.css' layer(tokens);\n.acme-page { margin: 0; }\n");
  config.products = { ...config.products, acme: { ...acme, styles: [`${DESIGN_DIR}/acme/styles.css`] } };
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify(config));

  const product = createSystemModules({ target, config }).productOf('acme');

  if (!product) throw new Error('no acme');

  const sketch = createSketch({
    product,
    sketch: { layer: 'foundations', name: 'palette' },
    variants: ['a', 'b'],
  }) as Sketch;
  const css = resolve(variantDirOf(sketch, 'a'), 'foundations', 'palette', 'palette.css');

  writeFileSync(css, readFileSync(css, 'utf8').replace(MERGED, SKETCHED));

  const vite = await createDesignServer({ target, config, listen: false });

  closing.push(() => vite.close());

  const compiled = async (variant: string | null) =>
    (
      await vite.transformRequest(
        productModuleIdOf({
          file: styles,
          product: 'acme',
          sketch: variant ? { target: 'foundations/palette', variant } : null,
        }),
      )
    )?.code ?? '';

  return { vite, compiled };
};

describe('a product stylesheet drawn for a sketch variant', () => {
  it("inlines the variant's file where it imports the merged part stylesheet", async () => {
    const { compiled } = await serveAcme();
    const [merged, a, b] = await Promise.all([compiled(null), compiled('a'), compiled('b')]);

    expect(merged).toContain(MERGED);
    expect(merged).not.toContain(SKETCHED);
    expect(a).toContain(SKETCHED);
    expect(a).not.toContain(MERGED);
    const cssOf = (code: string) => code.split('__vite__css')[1]?.replace(/\\n|\s/gu, '');

    expect(cssOf(a)).toBe(cssOf(merged)?.replace(MERGED, SKETCHED));
    expect(b).toContain(MERGED);
  });

  it('is what a frame of a variant that draws a part stylesheet of its own loads', async () => {
    const { vite } = await serveAcme();
    const env = String((await vite.pluginContainer.load('\0virtual:design-explore/env'))?.toString() ?? '');

    expect(env).toMatch(
      /\n {6}"a": \(\) => Promise\.resolve\(\)\.then\(\(\) => import\("[^"]*acme\/styles\.css\?design-product=acme&design-sketch=foundations%2Fpalette&design-variant=a"\)\),\n/u,
    );
  });
});
