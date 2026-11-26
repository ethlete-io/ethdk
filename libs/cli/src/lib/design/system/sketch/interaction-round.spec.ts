import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { interactionRoundLinesOf } from './interaction-round';
import { addVariant, createSketch, Sketch, SketchTarget } from './sketch';
import { SketchPartLoader } from './unchanged-states';

const productOf = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-interaction-round-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

const restOnly = { states: { logo: {}, fallback: {} }, grid: { rows: { logo: { rest: 'logo' } } } };

const interactive = (interactions: string[]) => ({
  states: Object.fromEntries(['logo', ...interactions.map((each) => `logo-${each}`)].map((state) => [state, {}])),
  grid: {
    rows: { logo: { rest: 'logo', ...Object.fromEntries(interactions.map((each) => [each, `logo-${each}`])) } },
  },
});

const loading =
  (byVariant: Record<string, unknown>): SketchPartLoader =>
  async ({ sketch }) => ({ default: byVariant[sketch?.variant ?? ''] });

const titleCard = (
  product: ReturnType<typeof productOf>,
  target: SketchTarget = { layer: 'components', name: 'title-card' },
) => createSketch({ product, sketch: target, variants: ['a', 'b'] }) as Sketch;

// Decision 25.11. (B752): the first sketch of a new part draws every variant only at rest per content, and only the round after the pick of a base variant draws hover, active, focus-visible and disabled.
describe('interactionRoundLinesOf', () => {
  it('refuses the interactions the tomflix title card drew in the first round of a new part', async () => {
    const product = productOf();
    const sketch = titleCard(product);
    const load = loading({ a: interactive(['hover', 'active', 'focus-visible']), b: restOnly });

    expect(await interactionRoundLinesOf({ product, sketch, load })).toEqual([
      'INTERACTION-ROUND components/title-card a components/title-card: the first round of a new part draws only ' +
        'rest, one state per content, but it draws hover, focus-visible, active - remove them; once the user picks ' +
        'a base variant, open a second round from it with `sketch variant components/title-card <key> --from ' +
        '<picked> --round <title> --note <why>` and draw them there',
    ]);
  });

  it('demands every interaction in the round after the pick, except the ones the round drops', async () => {
    const product = productOf();
    const picked = addVariant({
      sketch: titleCard(product),
      variant: 'c',
      from: 'a',
      round: { title: 'Interaktion', lostNote: 'a is the base' },
    }) as Sketch;
    const load = loading({ a: restOnly, b: restOnly, c: interactive(['hover', 'active', 'focus-visible']) });

    expect(await interactionRoundLinesOf({ product, sketch: picked, load })).toEqual([
      'INTERACTION-ROUND components/title-card c components/title-card: round r2 draws the interactions of the ' +
        'picked base, but it lacks disabled - draw them (interactionRows or `interactions`, a disabled row), or ' +
        'drop the ones the part cannot have with `sketch round components/title-card r2 --drops disabled`',
    ]);

    const dropped = { ...picked, rounds: picked.rounds.map((round) => ({ ...round, drops: ['disabled'] })) };

    expect(await interactionRoundLinesOf({ product, sketch: dropped, load })).toEqual([]);
  });

  it('leaves a sketch of a part the product has alone', async () => {
    const product = productOf();
    const sketch = titleCard(product, { layer: 'elements', name: 'hero' });
    const load = loading({ a: interactive(['hover']), b: restOnly });

    expect(await interactionRoundLinesOf({ product, sketch, load })).toEqual([]);
  });
});
