import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { visibleChangeOf } from './change-box';
import { createSketch, Sketch } from './sketch';
import { SketchPartLoader } from './unchanged-states';
import { WEAK_STATE_PIXELS, WEAK_STATE_REACH, weakStateWarningsOf } from './weak-states';

const SHOTS = resolve(__dirname, '__fixtures__', 'weak-states');

const shot = (state: string) => readFileSync(join(SHOTS, `${state}.png`));

const cardSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-weak-states-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const states = {
  default: {},
  'default-hover': {},
  'default-focus-visible': {},
  tonal: {},
  'tonal-hover': {},
};

const load: SketchPartLoader = async () => ({
  default: {
    states,
    grid: {
      columns: ['rest', 'hover', 'focus-visible'],
      rows: {
        default: { rest: 'default', hover: 'default-hover', 'focus-visible': 'default-focus-visible' },
        tonal: { rest: 'tonal', hover: 'tonal-hover' },
      },
    },
    render: () => ({ body: '', styles: '' }),
  },
});

const pictureOf: PictureOf = async ({ state }) => ({ png: shot(state), marks: [] });

describe('weakStateWarningsOf', () => {
  it('warns about the title card hover that only lifts the poster and the focus ring that draws nothing', async () => {
    const { product, sketch } = cardSketch();

    const warnings = await weakStateWarningsOf({ product, sketch, load, pictureOf });

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(
      /^elements\/hero a: elements\/hero default-hover barely differs from its rest state default - \d+ px change beyond a shift of 4 px; .* give default-hover a change the user sees next to default \(colour, surface, outline or shadow\)$/u,
    );
    expect(warnings[1]).toMatch(/elements\/hero default-focus-visible barely differs from its rest state default/u);
  });

  it('measures the lifted poster as a shift and the button hover as a visible change', () => {
    const options = { reach: WEAK_STATE_REACH, limit: Number.MAX_SAFE_INTEGER };

    expect(visibleChangeOf({ before: shot('default'), after: shot('default-hover') }, options)).toBeLessThan(
      WEAK_STATE_PIXELS,
    );
    expect(visibleChangeOf({ before: shot('tonal'), after: shot('tonal-hover') }, options)).toBeGreaterThan(
      WEAK_STATE_PIXELS * 10,
    );
  });
});
