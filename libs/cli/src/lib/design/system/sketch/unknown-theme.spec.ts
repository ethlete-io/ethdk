import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from './sketch';
import { definedThemesIn, unknownThemeWarningsOf, usedThemesIn } from './unknown-theme';
import { SketchPartLoader } from './unchanged-states';

const FIXTURES = resolve(__dirname, '__fixtures__', 'unknown-theme');

const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const heroSketch = (colors: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-unknown-theme-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.ethlete/design/acme/foundations/palette/palette.css'), colors);

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;

  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: { states: { rest: {} }, render: () => ({ body: '', styles: '' }) },
});

const pictureOf: PictureOf = async () => ({ png: Buffer.alloc(0), marks: [], markup: fixture('danger-button.html') });

describe('usedThemesIn and definedThemesIn', () => {
  it('reads danger from the real tomflix button and no theme from the real tomflix colors foundation', () => {
    expect(usedThemesIn(fixture('danger-button.html'))).toEqual(['danger']);
    expect(definedThemesIn([fixture('tomflix-colors.css')])).toEqual([]);
  });

  it('skips the inherited marker', () => {
    expect(usedThemesIn('<button class="et-button et-color--inherited">Go</button>')).toEqual([]);
  });

  it('reads every theme a stylesheet defines with a selector', () => {
    expect(definedThemesIn(['.et-surface--dark .et-color--error, .et-color--warning { color: red }'])).toEqual([
      'error',
      'warning',
    ]);
  });
});

describe('unknownThemeWarningsOf', () => {
  it('warns for the real tomflix danger button when the real colors foundation defines no theme', async () => {
    const { product, sketch } = heroSketch(fixture('tomflix-colors.css'));
    const warnings = await unknownThemeWarningsOf({ product, sketch, load, pictureOf });

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('et-color--danger, which no foundation of the product defines');
    expect(warnings[0]).toContain('the product defines no named theme - add the theme to the colors foundation');
  });

  it('names the defined themes', async () => {
    const colors = `${fixture('tomflix-colors.css')}\n.et-color--error { --et-color-primary: 239 68 68; }\n.et-color--warning { --et-color-primary: 245 158 11; }`;
    const { product, sketch } = heroSketch(colors);
    const warnings = await unknownThemeWarningsOf({ product, sketch, load, pictureOf });

    expect(warnings[0]).toContain('defined: error, warning');
  });

  it('stays quiet once the foundation defines the theme', async () => {
    const colors = `${fixture('tomflix-colors.css')}\n.et-color--danger { --et-color-primary: 239 68 68; }`;
    const { product, sketch } = heroSketch(colors);

    expect(await unknownThemeWarningsOf({ product, sketch, load, pictureOf })).toEqual([]);
  });
});
