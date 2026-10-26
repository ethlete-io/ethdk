import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { mergePreviewOf } from './merge-preview';
import { createSketch, Sketch } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-preview-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('mergePreviewOf', () => {
  it('lists each element and page that uses a changed part, also through another part', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'components', name: 'button' },
      variants: ['a'],
    }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' })).toEqual({
      changed: ['components/button'],
      affected: ['elements/hero', 'pages/home'],
    });
  });

  it('lists nobody for a new part', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'banner' }, variants: ['a'] }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' })).toEqual({ changed: ['elements/banner'], affected: [] });
  });

  it('leaves out the components between a change and a page', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    expect(mergePreviewOf({ product, sketch, variant: 'a' }).affected).toEqual(['pages/home']);
  });
});
