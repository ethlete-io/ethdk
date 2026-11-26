import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { sketchesAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, parseTarget } from './system/sketch/sketch';
import { CheckSketches, openSketchListingAt } from './system/sketch/sketch-checker';

const SDK_BUTTON = resolve(__dirname, '../../../../../.ethlete/design/sdk/components/button');
const INSTALLED = 'node_modules/@ethlete/components/design';

const withInteractions = (rows: string[]) =>
  rows.flatMap((row) => [row, `${row}-hover`, `${row}-active`, `${row}-focus-visible`]);

const SDK_STATES = [
  ...withInteractions(['filled', 'outline', 'tonal', 'transparent', 'pressed', 'danger', 'small']),
  'disabled',
];
const VARIANT_A_STATES = [...withInteractions(['default', 'tonal', 'outline']), 'disabled'];

const writeJson = (file: string, value: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value), 'utf8');
};

const tomflixButtonSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-inherited-states-'));
  const config = { styles: [], base: '@ethlete/components', schemes: ['dark' as const] };

  writeJson(join(target, DESIGN_DIR, 'config.json'), { products: { tomflix: config } });
  mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });
  cpSync(SDK_BUTTON, join(target, INSTALLED, 'sdk/components/button'), { recursive: true });
  writeJson(join(target, INSTALLED, 'config.json'), { products: { sdk: { presets: { desktop: { width: 1440 } } } } });

  const product = resolveProduct({ target, name: 'tomflix', config });
  const parsed = parseTarget('components/button');
  const created =
    typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants: ['a'], merge: 'override' });

  if (typeof created === 'string') throw new Error(created);

  return target;
};

const checkSketches: CheckSketches = async (request) => {
  const listing = openSketchListingAt(request);

  if (typeof listing === 'string') throw new Error(listing);

  return listing;
};

describe('a sketch of a part inherited from the SDK', () => {
  // The tomflix button variant a draws no filled, transparent or pressed state, so the listing names those SDK states as inherited and the Studio shows them instead of "fehlt in dieser Variante".
  it('lists the SDK states a variant does not draw as inherited', async () => {
    const target = tomflixButtonSketch();
    const answer = await sketchesAnswer({
      target,
      url: new URL('http://localhost/__design/sketches?product=tomflix&unchanged=no'),
      request: { method: 'GET' } as IncomingMessage,
      load: async ({ file }) => ({
        default: {
          note: 'n',
          states: Object.fromEntries(
            (file.includes('/sketches/') ? VARIANT_A_STATES : SDK_STATES).map((state) => [state, {}]),
          ),
        },
      }),
      checkSketches,
    });
    const listed = answer.body as { sketches: { targets?: { variant: string; inherited?: string[] }[] }[] };

    expect(listed.sketches[0]?.targets?.map(({ variant, inherited }) => ({ variant, inherited }))).toEqual([
      { variant: 'a', inherited: SDK_STATES.filter((state) => !VARIANT_A_STATES.includes(state)) },
    ]);
  });
});
