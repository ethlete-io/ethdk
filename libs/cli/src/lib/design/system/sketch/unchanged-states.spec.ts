import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { partKeyOf, resolveProduct } from '../resolve-product';
import { createSketch, sharedDirOf, Sketch, variantDirOf } from './sketch';
import { PictureOf } from '../../merge-compare';
import { createShotStore } from '../../shot-store';
import { encodePng } from '../part-compare';
import { interactionRows } from '../../../../../design/interaction-rows';
import { shownSketchRowsOf } from '../../sketch-frame-set';
import {
  forgetUnchangedStates,
  keptComparisonOf,
  keptSameAsRestOf,
  sameAsRestAtSizesOf,
  sameAsRestOf,
  SketchPartLoader,
  unchangedForFoldOf,
  unchangedStatesOf,
} from './unchanged-states';

const compareCode = vi.hoisted(() => ({ value: 'compare-1' }));

vi.mock('../../code-hash', async (actual) => ({
  ...(await actual<typeof import('../../code-hash')>()),
  sketchCompareCodeOf: () => compareCode.value,
}));

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-unchanged-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

  return { product, sketch, hero: resolve(variantDirOf(sketch, 'a'), 'elements', 'hero') };
};

const counting = () => {
  const calls: string[] = [];
  const load: SketchPartLoader = async ({ file }) => {
    calls.push(file);

    const source = readFileSync(file, 'utf8');
    const styles = readFileSync(resolve(dirname(file), 'hero.css'), 'utf8');

    return {
      default: {
        states: source.includes('fresh:')
          ? { default: { title: 'Dune' }, fresh: { title: 'New' } }
          : { default: { title: 'Dune' } },
        render: ({ title }: { title: string }) => ({
          body: source.includes('spaced') ? `<h1>  ${title}</h1>` : `<h1>${title}</h1>`,
          styles,
        }),
        frame: (body: string) => (source.includes('framed') ? `<div class="frame">${body}</div>` : body),
      },
    };
  };

  return { calls, load };
};

describe('unchangedStatesOf', () => {
  it('names a state the variant renders the same', async () => {
    const { product, sketch } = acme();

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual(['default']);
  });

  it('names no state of the edit sketch variant new when the sketch has no old to compare with', async () => {
    const { product } = acme();
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero', sketch: 'edit' },
      variants: ['new'],
    }) as Sketch;

    expect(await unchangedStatesOf({ product, sketch, variant: 'new', load: counting().load })).toEqual([]);
  });

  it('names no state of the edit sketch variant new when the sketch has old', async () => {
    const { product } = acme();
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero', sketch: 'edit' },
      variants: ['new', 'old'],
    }) as Sketch;

    expect(await unchangedStatesOf({ product, sketch, variant: 'new', load: counting().load })).toEqual([]);
  });

  it('draws the edit sketch variant new as spare work at the first frame where it draws old against the product', async () => {
    const { product } = acme();
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero', sketch: 'edit' },
      variants: ['new', 'old'],
    }) as Sketch;
    const { load: plain } = counting();
    const load: SketchPartLoader = async (options) => {
      const loaded = (await plain(options)) as { default: object };

      return { default: { ...loaded.default, widths: [320, 1440] } };
    };
    const drawn: string[] = [];
    const pictureOf: PictureOf = async ({ sketch: on, state, width, priority }) => {
      drawn.push(`${state}@${width} ${on?.variant ?? 'now'}${priority ? ` ${priority}` : ''}`);

      return { png: Buffer.from(on?.variant ?? 'now'), marks: [] };
    };

    writeFileSync(resolve(variantDirOf(sketch, 'old'), 'elements', 'hero', 'hero.css'), '.acme-hero { color: red; }');

    expect(await unchangedStatesOf({ product, sketch, variant: 'old', load, pictureOf })).toEqual([]);
    expect(drawn.filter((entry) => entry.includes(' new'))).toEqual(['default@320 new spare']);
    expect(new Set(drawn.filter((entry) => entry.endsWith(' old')))).toEqual(
      new Set(['default@320 old', 'default@1440 old']),
    );
  });

  it('leaves out a state whose demo frame the variant changed', async () => {
    const { product, sketch, hero } = acme();
    const file = resolve(hero, 'hero.ts');

    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// framed\n`);

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
  });

  it('leaves out a state whose styles the variant changed', async () => {
    const { product, sketch, hero } = acme();

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
  });

  it('names a state whose styles changed when every frame draws the same pixels', async () => {
    const { product, sketch, hero } = acme();
    const drawn: string[] = [];
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on, state }) => {
        drawn.push(`${state} ${on?.variant ?? 'now'}`);

        return { png: Buffer.from(pixels(on?.variant ?? null)), marks: [] };
      };

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero-empty { color: red; }');

    expect(
      await unchangedStatesOf({
        product,
        sketch,
        variant: 'a',
        load: counting().load,
        pictureOf: pictureOf(() => 'x'),
      }),
    ).toEqual(['default']);
    expect(drawn.sort()).toEqual(['default a', 'default now']);

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(
      await unchangedStatesOf({
        product,
        sketch,
        variant: 'a',
        load: counting().load,
        pictureOf: pictureOf((variant) => variant ?? 'now'),
      }),
    ).toEqual([]);
  });

  it('folds a restyled state that draws no pixel change, and keeps the compare for Studio', async () => {
    const { product, sketch, hero } = acme();
    const pictureOf: PictureOf = async () => ({ png: Buffer.from('x'), marks: [] });

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero-empty { color: red; }');

    const folded = await unchangedForFoldOf({ product, sketch, variant: 'a', load: counting().load, pictureOf });
    const kept = await keptComparisonOf({ product, sketch, variant: 'a', pictured: true });

    expect(folded).toEqual(['default']);
    expect(kept?.unchanged).toEqual(folded);
    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
  });

  describe('when only the markup differs', () => {
    const spaced = () => {
      const made = acme();
      const file = resolve(made.hero, 'hero.ts');

      writeFileSync(file, `${readFileSync(file, 'utf8')}\n// spaced\n`);

      return made;
    };
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on }) => ({ png: Buffer.from(pixels(on?.variant ?? null)), marks: [] });

    it('names a state when every frame draws the same pixels', async () => {
      const { product, sketch } = spaced();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: counting().load,
          pictureOf: pictureOf(() => 'x'),
        }),
      ).toEqual(['default']);
    });

    it('leaves out a state when a frame draws other pixels', async () => {
      const { product, sketch } = spaced();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: counting().load,
          pictureOf: pictureOf((variant) => variant ?? 'now'),
        }),
      ).toEqual([]);
    });

    it('leaves out a state without a pixel compare', async () => {
      const { product, sketch } = spaced();

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual([]);
    });

    it('checks fresh screenshots after a transient failure without a source edit', async () => {
      const { product, sketch } = spaced();
      let failed = true;
      let shots = 0;
      const pictureOf: PictureOf = async () => {
        shots++;
        if (failed) throw new Error('temporary screenshot failure');

        return { png: Buffer.from('same'), marks: [] };
      };
      const options = { product, sketch, variant: 'a', load: counting().load, pictureOf };

      expect(await unchangedStatesOf(options)).toEqual([]);
      failed = false;
      expect(await unchangedStatesOf(options)).toEqual(['default']);
      expect(shots).toBe(4);
    });

    it('leaves out a state whose pair was drawn fresh and differs, with no second draw', async () => {
      const { product, sketch } = spaced();
      let shots = 0;
      const pictureOf: PictureOf = async ({ sketch: on }) => {
        shots++;

        return { png: Buffer.from(on ? 'after' : 'now'), marks: [], source: 'drawn' };
      };

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load, pictureOf })).toEqual([]);
      expect(shots).toBe(2);
    });

    it('names a state whose stale cached picture differs but whose fresh pair draws the same', async () => {
      const { product, sketch } = spaced();
      const pictureOf: PictureOf = async ({ sketch: on, fresh }) =>
        fresh
          ? { png: Buffer.from('same'), marks: [], source: 'drawn' }
          : { png: Buffer.from(on ? 'same' : 'stale'), marks: [], source: on ? 'drawn' : 'memory' };

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load, pictureOf })).toEqual([
        'default',
      ]);
    });

    it('does not reuse a matching image result for a later screenshot session', async () => {
      const { product, sketch } = spaced();
      const options = { product, sketch, variant: 'a', load: counting().load };

      expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
      expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual([]);
    });

    describe('with keepPictures', () => {
      it('keeps where a changed state differs, and no box for an unchanged one', async () => {
        const { product, sketch } = spaced();
        const blank = Buffer.alloc(40 * 20 * 4, 255);
        const marked = Buffer.from(blank);

        marked.fill(0, (5 * 40 + 30) * 4, (5 * 40 + 34) * 4);

        const pngOf: PictureOf = async ({ sketch: on }) => ({
          png: encodePng({ width: 40, height: 20, data: on ? marked : blank }),
          marks: [],
        });
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true, pictureOf: pngOf };

        expect(await unchangedStatesOf(options)).toEqual([]);
        expect(await keptComparisonOf({ product, sketch, variant: 'a', pictured: true })).toEqual({
          unchanged: [],
          changes: {
            default: {
              width: 40,
              height: 20,
              box: { x: 30, y: 5, width: 4, height: 1 },
              areas: [{ x: 30, y: 5, width: 4, height: 1 }],
              pixels: 4,
              regions: 1,
            },
          },
        });
      });

      it('reuses the pixel compare until a source changes', async () => {
        const { product, sketch, hero } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual([
          'default',
        ]);

        writeFileSync(resolve(hero, 'hero.css'), 'h1 { color: red; }\n');

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual(
          [],
        );
      });

      it('compares again after forgetUnchangedStates', async () => {
        const { product, sketch } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        forgetUnchangedStates();
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual(
          [],
        );
      });

      it('keeps the pixel compare across a change to another part, and drops it for a change to its own', async () => {
        const { product, sketch } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
        const differs = pictureOf((variant) => variant ?? 'now');

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        forgetUnchangedStates({
          all: false,
          parts: [
            { product: product.name, part: 'elements/other', sketch: null },
            { product: product.name, part: sketch.target, sketch: { target: 'elements/other', variant: 'a' } },
          ],
        });
        expect(await unchangedStatesOf({ ...options, pictureOf: differs })).toEqual(['default']);
        forgetUnchangedStates({
          all: false,
          parts: [{ product: product.name, part: sketch.target, sketch: { target: sketch.target, variant: 'a' } }],
        });
        expect(await unchangedStatesOf({ ...options, pictureOf: differs })).toEqual([]);
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual([]);
        forgetUnchangedStates({ all: false, parts: [{ product: product.name, part: sketch.target, sketch: null }] });
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
      });

      it('keeps the pixel compare after a file of a part it does not draw changes', async () => {
        const { product, sketch } = spaced();
        const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
        const button = product.parts.find((part) => partKeyOf(part) === 'components/button')?.file ?? '';

        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same') })).toEqual(['default']);
        appendFileSync(button, '\n');
        forgetUnchangedStates({
          all: false,
          parts: [{ product: product.name, part: 'components/button', sketch: null }],
        });
        expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf((variant) => variant ?? 'now') })).toEqual([
          'default',
        ]);
      });

      it('does not keep a result whose draw failed', async () => {
        const { product, sketch } = spaced();
        let failed = true;
        const flaky: PictureOf = async () => {
          if (failed) throw new Error('temporary screenshot failure');

          return { png: Buffer.from('same'), marks: [] };
        };
        const options = { product, sketch, variant: 'a', load: counting().load, pictureOf: flaky, keepPictures: true };

        expect(await unchangedStatesOf(options)).toEqual([]);
        failed = false;
        expect(await unchangedStatesOf(options)).toEqual(['default']);
      });

      describe('with a shot store', () => {
        const stored = () => {
          const made = spaced();
          const theme = join(made.product.dir, 'theme.css');
          const dir = mkdtempSync(join(tmpdir(), 'cli-design-unchanged-store-'));

          writeFileSync(theme, ':root { --tone: blue; }\n');

          const storeOf = (code = 'v1') =>
            createShotStore({
              dir,
              salt: '',
              code,
              checkout: made.product.dir,
              inputsOf: () => [theme],
              scopeOf: () => '',
            });

          return { ...made, theme, storeOf };
        };
        const drawing = () => {
          let draws = 0;
          const differs: PictureOf = async ({ sketch: on }) => {
            draws += 1;

            return { png: Buffer.from(on?.variant ?? 'now'), marks: [] };
          };

          return { differs, draws: () => draws };
        };

        it('reads a compare a former server kept, drawing nothing on a cold start', async () => {
          const { product, sketch, storeOf } = stored();
          const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
          const second = drawing();

          expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same'), store: storeOf() })).toEqual(
            ['default'],
          );
          forgetUnchangedStates();
          expect(await unchangedStatesOf({ ...options, pictureOf: second.differs, store: storeOf() })).toEqual([
            'default',
          ]);
          expect(second.draws()).toBe(0);
          expect(await keptComparisonOf({ product, sketch, variant: 'a', pictured: true })).toEqual({
            unchanged: ['default'],
            changes: {},
          });
        });

        it('compares again on a cold start once a file both sides draw from changed', async () => {
          const { product, sketch, theme, storeOf } = stored();
          const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
          const second = drawing();

          expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same'), store: storeOf() })).toEqual(
            ['default'],
          );
          forgetUnchangedStates();
          writeFileSync(theme, ':root { --tone: red; }\n');
          expect(await unchangedStatesOf({ ...options, pictureOf: second.differs, store: storeOf() })).toEqual([]);
          expect(second.draws()).toBeGreaterThan(0);
        });

        it('compares again on a cold start once the cli compares pictures with other code', async () => {
          const { product, sketch, storeOf } = stored();
          const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
          const second = drawing();

          expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same'), store: storeOf() })).toEqual(
            ['default'],
          );
          forgetUnchangedStates();
          compareCode.value = 'compare-2';
          try {
            expect(await unchangedStatesOf({ ...options, pictureOf: second.differs, store: storeOf() })).toEqual([]);
            expect(second.draws()).toBeGreaterThan(0);
          } finally {
            compareCode.value = 'compare-1';
          }
        });

        it('compares again on a cold start with another picture code', async () => {
          const { product, sketch, storeOf } = stored();
          const options = { product, sketch, variant: 'a', load: counting().load, keepPictures: true };
          const second = drawing();

          expect(await unchangedStatesOf({ ...options, pictureOf: pictureOf(() => 'same'), store: storeOf() })).toEqual(
            ['default'],
          );
          forgetUnchangedStates();
          expect(await unchangedStatesOf({ ...options, pictureOf: second.differs, store: storeOf('v2') })).toEqual([]);
          expect(second.draws()).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('when the markup only renders in a browser', () => {
    const browserOnly: SketchPartLoader = async (options) => {
      const loaded = (await counting().load(options)) as { default: Record<string, unknown> };

      return {
        default: {
          ...loaded.default,
          render: () => {
            throw new ReferenceError('location is not defined');
          },
        },
      };
    };
    const pictureOf =
      (pixels: (variant: string | null) => string): PictureOf =>
      async ({ sketch: on }) => ({ png: Buffer.from(pixels(on?.variant ?? null)), marks: [] });

    it('names a state when every frame draws the same pixels', async () => {
      const { product, sketch } = acme();

      expect(
        await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly, pictureOf: pictureOf(() => 'x') }),
      ).toEqual(['default']);
    });

    it('leaves out a state when a frame draws other pixels', async () => {
      const { product, sketch } = acme();

      expect(
        await unchangedStatesOf({
          product,
          sketch,
          variant: 'a',
          load: browserOnly,
          pictureOf: pictureOf((variant) => variant ?? 'now'),
        }),
      ).toEqual([]);
    });

    it('leaves out a state without a pixel compare', async () => {
      const { product, sketch } = acme();

      expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly })).toEqual([]);
    });

    it('leaves out a state that is new in the variant', async () => {
      const { product, sketch, hero } = acme();
      const file = resolve(hero, 'hero.ts');

      writeFileSync(file, `${readFileSync(file, 'utf8')}\n// fresh: {}\n`);

      expect(
        await unchangedStatesOf({ product, sketch, variant: 'a', load: browserOnly, pictureOf: pictureOf(() => 'x') }),
      ).toEqual(['default']);
    });
  });

  it('leaves out a state that is new in the variant', async () => {
    const { product, sketch, hero } = acme();
    const file = resolve(hero, 'hero.ts');

    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// fresh: {}\n`);

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load: counting().load })).toEqual(['default']);
  });

  it('renders again only after a file changes', async () => {
    const { product, sketch, hero } = acme();
    const { calls, load } = counting();

    await unchangedStatesOf({ product, sketch, variant: 'a', load });
    await unchangedStatesOf({ product, sketch, variant: 'a', load });

    expect(calls).toHaveLength(2);

    writeFileSync(resolve(hero, 'hero.css'), '.acme-hero { color: red; }');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual([]);
    expect(calls).toHaveLength(4);
  });

  it('renders again after a file in the sketch shared folder changes', async () => {
    const { product, sketch } = acme();
    const shared = resolve(sharedDirOf(sketch), 'data.ts');
    const { calls, load: counted } = counting();
    const load: SketchPartLoader = async (options) => {
      const loaded = (await counted(options)) as { default: { render: (props: unknown) => { body: string } } };
      const spaced = options.sketch !== null && readFileSync(shared, 'utf8').includes('spaced');

      return {
        default: {
          ...loaded.default,
          render: (props: unknown) => ({ ...loaded.default.render(props), ...(spaced ? { body: 'spaced' } : {}) }),
        },
      };
    };

    mkdirSync(dirname(shared), { recursive: true });
    writeFileSync(shared, 'export const rows = [];');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual(['default']);

    writeFileSync(shared, 'export const rows = []; // spaced');

    expect(await unchangedStatesOf({ product, sketch, variant: 'a', load })).toEqual([]);
    expect(calls).toHaveLength(4);
  });
});

describe('sameAsRestOf', () => {
  const titleCard = () => {
    const { states, grid } = interactionRows(
      Object.fromEntries(
        ['film', 'film-4k', 'series-new-season', 'series-episodes', 'long-title'].map((row) => [row, { row }]),
      ) as Record<string, { row: string; interaction?: string }>,
      {
        interactions: ['hover', 'focus-visible', 'active'],
        force: (props, interaction) => ({ ...props, interaction }),
      },
    );
    const load: SketchPartLoader = async () => ({
      default: {
        states,
        grid,
        widths: [168, 112],
        render: ({ row, interaction }: { row: string; interaction?: string }) => ({
          body: `<a class="card ${interaction ?? ''}">${row}</a>`,
          styles: '.card.focus-visible { outline: 3px solid teal; }',
        }),
      },
    });
    const drawn: string[] = [];
    const pictureOf: PictureOf = async ({ state, width }) => {
      drawn.push(`${state}@${width}`);

      return {
        png: Buffer.from(state.endsWith('-focus-visible') ? `${state} ring` : state.replace(/-(hover|active)$/u, '')),
        marks: [],
      };
    };

    return { load, pictureOf, drawn, states: Object.keys(states) };
  };

  it('names every interaction state of the title card that draws like its rest state at each width', async () => {
    forgetUnchangedStates();
    const { product, sketch } = acme();
    const { load, pictureOf, drawn } = titleCard();

    const same = await sameAsRestOf({ product, sketch, variant: 'a', load, pictureOf });

    expect(Object.keys(same).sort()).toEqual(
      ['film', 'film-4k', 'series-new-season', 'series-episodes', 'long-title']
        .flatMap((row) => [`${row}-hover`, `${row}-active`])
        .sort(),
    );
    expect(same['film-4k-hover']).toBe('film-4k');
    expect(drawn).toContain('film-hover@112');
    expect(await keptSameAsRestOf({ product, sketch, variant: 'a', pictured: true })).toEqual(same);
  });

  it('keeps a state that differs from rest at one width only', async () => {
    forgetUnchangedStates();
    const { product, sketch } = acme();
    const { load } = titleCard();
    const pictureOf: PictureOf = async ({ state, width }) => ({
      png: Buffer.from(
        state === 'film-hover' && width === 112 ? 'lifted' : state.replace(/-(hover|active|focus-visible)$/u, ''),
      ),
      marks: [],
    });

    const same = await sameAsRestOf({ product, sketch, variant: 'a', load, pictureOf });

    expect(same['film-hover']).toBeUndefined();
    expect(same['film-active']).toBe('film');
    expect((await sameAsRestAtSizesOf({ product, sketch, variant: 'a', load, pictureOf }))['film-hover']).toEqual({
      rest: 'film',
      sizes: ['168'],
    });
  });

  it('folds the title card to its rest and focus columns in the sketch view', async () => {
    forgetUnchangedStates();
    const { product, sketch } = acme();
    const { load, pictureOf, states } = titleCard();
    const same = await sameAsRestOf({ product, sketch, variant: 'a', load, pictureOf });
    const shots = states.map((state) => ({ state, changed: true, ...(state in same ? { sameAsRest: true } : {}) }));

    const [row] = shownSketchRowsOf({ listed: [{ key: 'a', shots }] });

    expect(row?.shots.map((shot) => shot.state)).toEqual(states.filter((state) => !/-(hover|active)$/u.test(state)));
    expect(shownSketchRowsOf({ listed: [{ key: 'a', shots }], open: true })[0]?.shots).toHaveLength(20);
  });
});
