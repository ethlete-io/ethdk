import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from './sketch';
import { textOnlyGroupsOf, textOnlyStateWarningsOf } from './text-only-states';
import { SketchPartLoader } from './unchanged-states';

const FIXTURES = resolve(__dirname, '__fixtures__');

const LOGO_1109 = ['mark', 'anatomy', 'clear-space', 'minimum-size', 'colour-variants', 'misuse', 'motion'];

const SKELETON = ['anatomy', 'clear-space', 'minimum-size', 'colour-variants', 'misuse', 'motion'];

const read = (folder: string, name: string) => readFileSync(join(FIXTURES, folder, name));

const logoSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-text-only-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const loadOf =
  (states: string[]): SketchPartLoader =>
  async () => ({
    default: {
      states: Object.fromEntries(states.map((state) => [state, {}])),
      render: () => ({ body: '<div></div>', styles: '' }),
    },
  });

const pictureOf =
  (folder: string): PictureOf =>
  async ({ state, params }) => ({
    png: read(folder, `${state}${params.get('textless') === '1' ? '.textless' : ''}.png`),
    marks: [],
  });

describe('textOnlyStateWarningsOf', () => {
  it('names the five states of the client run 1109 logo that draw one picture under other words', async () => {
    const { product, sketch } = logoSketch();

    const warnings = await textOnlyStateWarningsOf({
      product,
      sketch,
      load: loadOf(LOGO_1109),
      pictureOf: pictureOf('logo-1109'),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('TEXT-ONLY elements/hero a: elements/hero states anatomy, clear-space,');
    expect(warnings[0]).toContain('colour-variants, misuse, motion draw the same picture under other words');
  });

  it('passes the logo skeleton, whose sections each draw their own picture', async () => {
    const { product, sketch } = logoSketch();

    expect(
      await textOnlyStateWarningsOf({
        product,
        sketch,
        load: loadOf(SKELETON),
        pictureOf: pictureOf('logo-skeleton'),
      }),
    ).toEqual([]);
  });
});

describe('textOnlyGroupsOf', () => {
  const shotsOf = (folder: string, states: string[]) =>
    states.map((state) => ({
      state,
      picture: read(folder, `${state}.png`),
      textless: read(folder, `${state}.textless.png`),
    }));

  it('leaves two text-only states to the look-alike checks', async () => {
    expect(await textOnlyGroupsOf(shotsOf('logo-1109', ['anatomy', 'clear-space']))).toEqual([]);
  });

  it('passes states that each draw something of their own', async () => {
    expect(await textOnlyGroupsOf(shotsOf('logo-1109', ['mark', 'anatomy', 'minimum-size']))).toEqual([]);
  });
});
