import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { interactionRows } from '../../../../../design/interaction-rows';
import { readConfig } from '../../design-config';
import { PictureOf } from '../../merge-compare';
import { resolveProduct } from '../resolve-product';
import { restLikeStateWarningsOf } from './rest-like-states';
import { createSketch, Sketch } from './sketch';
import { forgetUnchangedStates, SketchPartLoader } from './unchanged-states';

const SHOTS = resolve(__dirname, '__fixtures__', 'rest-like-button');

const buttonSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rest-like-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch };
};

const { states, grid } = interactionRows(
  {
    default: { kind: 'primary', disabled: false },
    disabled: { kind: 'primary', disabled: true },
    secondary: { kind: 'secondary', disabled: false },
    'secondary-disabled': { kind: 'secondary', disabled: true },
  } as Record<string, { kind: string; disabled: boolean; interaction?: string }>,
  {
    interactions: ['hover', 'focus-visible', 'active'],
    force: (props, interaction) => ({ ...props, interaction }),
  },
);

const load: SketchPartLoader = async () => ({
  default: {
    states,
    grid,
    render: ({ kind, disabled, interaction }: { kind: string; disabled: boolean; interaction?: string }) => ({
      body: `<button class="button ${kind} ${interaction ?? ''}"${disabled ? ' disabled' : ''}>Play</button>`,
      styles: '',
    }),
  },
});

const pictureOf: PictureOf = async ({ state }) => ({
  png: readFileSync(join(SHOTS, `${state}.png`)),
  marks: [],
});

describe('restLikeStateWarningsOf', () => {
  it('warns about the button hover that draws the same pixels as its rest state, with a fix', async () => {
    forgetUnchangedStates();
    const { product, sketch } = buttonSketch();

    const warnings = await restLikeStateWarningsOf({ product, sketch, load, pictureOf });

    expect(warnings).toEqual([
      'elements/hero a: elements/hero default-hover draws the same as its rest state default - ' +
        'give default-hover a change the user sees next to default (colour, surface, outline or shadow), ' +
        'or drop it from the grid when the part has no such state',
    ]);
  });
});
