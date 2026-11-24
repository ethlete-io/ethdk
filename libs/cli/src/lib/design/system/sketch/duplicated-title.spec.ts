import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { duplicatedTitleWarningsOf, duplicatesTitleIn } from './duplicated-title';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const FIXTURES = resolve(__dirname, '__fixtures__', 'duplicated-title');

const markupOf = (name: string) => readFileSync(join(FIXTURES, `${name}.html`), 'utf8');

const titleCardSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-duplicated-title-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b', 'c'],
  }) as Sketch;

  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: { states: { logo: {}, fallback: {} }, render: () => ({ body: '', styles: '' }) },
});

const pictureOf: PictureOf = async ({ sketch, state }) => ({
  png: Buffer.alloc(0),
  marks: [],
  markup: markupOf(`${sketch?.variant}-${state}`),
});

describe('duplicatesTitleIn', () => {
  it('flags a logo drawn under a poster marked as carrying the title, the real card of variant a', () => {
    expect(duplicatesTitleIn(markupOf('a-logo'))).toBe(true);
  });

  it('stays quiet for a logo over an unmarked backdrop, the real cards of variants b and c', () => {
    expect(duplicatesTitleIn(markupOf('b-logo'))).toBe(false);
    expect(duplicatesTitleIn(markupOf('c-logo'))).toBe(false);
  });

  it('stays quiet for a written title in a span next to a marked poster', () => {
    expect(duplicatesTitleIn(markupOf('a-fallback'))).toBe(false);
  });

  it('flags a heading next to a marked image', () => {
    expect(duplicatesTitleIn('<img data-et-carries-title src="/x/a.webp" alt=""><h2>Film</h2>')).toBe(true);
  });

  it('stays quiet for a heading next to an image whose file name says poster, without the marker', () => {
    expect(duplicatesTitleIn('<img src="/x/film-poster.webp" alt=""><h2>Film</h2>')).toBe(false);
  });
});

describe('duplicatedTitleWarningsOf', () => {
  it('warns about variant a only, with how to fix it', async () => {
    const { product, sketch } = titleCardSketch();

    const warnings = await duplicatedTitleWarningsOf({ product, sketch, load, pictureOf });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(' a: ');
    expect(warnings[0]).toContain('logo');
    expect(warnings[0]).toContain('drop the separate title');
  });
});
