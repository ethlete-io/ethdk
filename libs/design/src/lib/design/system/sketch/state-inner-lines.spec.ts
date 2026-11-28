import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from './sketch';
import { stateInnerLinesOf } from './state-inner-lines';
import { SketchPartLoader } from './unchanged-states';

const drawn = (state: string) =>
  readFileSync(resolve(__dirname, '../rules/__fixtures__/shell-inner-hover', `${state}.html`), 'utf8');

const shellSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-state-inner-'));

  const elements = join(target, '.ethlete/design/acme/elements');

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  mkdirSync(join(elements, 'shell'));
  cpSync(join(elements, 'hero/hero.ts'), join(elements, 'shell/shell.ts'));

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'shell' }, variants: ['a'] }) as Sketch;
  return { product, sketch };
};

const load: SketchPartLoader = async () => ({
  default: {
    states: { startseite: {}, 'search-hover': { hover: 'search' }, 'nav-hover': { hover: 'nav' } },
    controls: {
      'shell-top-nav': { kind: 'row', input: ['pointer', 'keyboard'] },
      'shell-search': { kind: 'button', part: 'components/button' },
    },
    render: ({ hover }: { hover?: string }) => ({
      body: drawn(hover === 'search' ? 'search-hover' : hover === 'nav' ? 'nav-hover' : 'startseite'),
      styles: '',
    }),
  },
});

describe('stateInnerLinesOf', () => {
  it('refuses the App Shell hover of its search button for each live variant, with the fix', async () => {
    const { product, sketch } = shellSketch();

    expect(await stateInnerLinesOf({ product, sketch, load })).toEqual([
      'STATE-INNER elements/shell a elements/shell: state "search-hover" differs from "startseite" only inside ' +
        'components/button: add the state in components/button and drop it from elements/shell, which draws ' +
        'components/button in its default',
    ]);
  });
});
