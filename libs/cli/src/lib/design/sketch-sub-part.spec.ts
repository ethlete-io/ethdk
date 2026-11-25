import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { designSketch } from './sketch-command';
import { resolveProduct } from './system/resolve-product';
import { variantProblemsOf } from './system/sketch/check-sketches';
import {
  changedSinceReadyOf,
  createSketch,
  findSketch,
  parseTarget,
  Sketch,
  SubPartDifference,
  variantContentHashOf,
  variantDirOf,
  writeSketchFile,
} from './system/sketch/sketch';

const SDK_BADGE = resolve(__dirname, '../../../../../.ethlete/design/sdk/components/badge');
const INSTALLED = 'node_modules/@ethlete/components/design';
const CONFIG = { styles: [], base: '@ethlete/components', schemes: ['dark' as const] };

const write = (file: string, text: string) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text, 'utf8');
};

const partSource = (body: string, imports = '') => `import { definePart, drawing } from '@design-system';
${imports}
type Props = Record<string, never>;

export default definePart<Props>({
  note: 'Ein Teil des Hero.',
  states: { rest: {} },
  describe: { rest: 'The part at rest; check that it reads.' },
  render: () => drawing({ body: \`${body}\`, styles: '' }),
});
`;

const TOMFLIX_INLINE_BADGES = [
  '<span class="flex items-center gap-2 text-xs text-et-surface-muted"',
  '  ><span class="size-[5px] rounded-full bg-et-theme"></span>${FIXTURE.badge}</span',
  '>',
  '<span class="text-xs font-semibold text-et-theme-ink">${FIXTURE.badge}</span>',
  '<span class="shrink-0 text-xs font-semibold text-et-surface-muted">${FIXTURE.badge}</span>',
].join('\n');

const TOMFLIX_LITERAL_BADGE = [
  '<div class="tsh-poster" style="--tsh-angle: 12deg">',
  '  <span class="tsh-badge">Serie</span>',
  '</div>',
].join('\n');

const TOMFLIX_CAPTION_TAGS = '<span class="text-et-theme-ink">Neu</span><span>Serie</span>';

const tomflixHero = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-sub-part-'));

  write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: CONFIG } }));
  write(
    join(target, DESIGN_DIR, 'tomflix/components/rating/rating.ts'),
    partSource('<span class="tf-rating">4,5</span>'),
  );
  cpSync(SDK_BADGE, join(target, INSTALLED, 'sdk/components/badge'), { recursive: true });
  write(
    join(target, INSTALLED, 'config.json'),
    JSON.stringify({ products: { sdk: { presets: { desktop: { width: 1440 } } } } }),
  );

  const product = () => resolveProduct({ target, name: 'tomflix', config: CONFIG });
  const parsed = parseTarget('elements/hero');
  const hero =
    typeof parsed === 'string'
      ? parsed
      : createSketch({ product: product(), sketch: parsed, variants: ['a', 'b', 'c'] });

  if (typeof hero === 'string') throw new Error(hero);

  for (const variant of hero.variants)
    write(
      resolve(variantDirOf(hero, variant), 'elements/hero/hero.ts'),
      partSource('<section class="tf-hero"></section>'),
    );

  const reread = (): Sketch => {
    const found = findSketch({
      productDir: join(target, DESIGN_DIR, 'tomflix'),
      product: 'tomflix',
      sketch: { layer: 'elements', name: 'hero' },
    });

    if (!found || typeof found === 'string') throw new Error('no hero sketch');

    return found;
  };
  const buildIn = (variant: string, key: string, source: string) =>
    write(resolve(variantDirOf(hero, variant), `${key}/${key.split('/')[1]}.ts`), source);
  const buildInC = (key: string, source: string) => buildIn('c', key, source);
  const markIn = (variant: string, subParts: string[], notRebuilds?: SubPartDifference[]) => {
    const sketch = reread();
    const info = { ...sketch.variantInfo[variant], subParts, notRebuilds };

    writeSketchFile({ ...sketch, variantInfo: { ...sketch.variantInfo, [variant]: info } }, { base: sketch });
  };
  const markInC = (subParts: string[], notRebuilds?: SubPartDifference[]) => markIn('c', subParts, notRebuilds);
  const linesOf = (variant: string) =>
    variantProblemsOf({ product: product(), sketch: reread(), productProblems: [] })
      .filter((entry) => entry.variant === variant)
      .flatMap(({ problems }) => problems.map((problem) => problem.message));
  const subPartLinesOfC = () =>
    variantProblemsOf({ product: product(), sketch: reread(), productProblems: [] })
      .filter(({ variant }) => variant === 'c')
      .flatMap(({ problems }) => problems.map((problem) => problem.message))
      .filter((message) => message.includes('sub-part') || message.includes('rebuild'));

  return { target, reread, buildIn, buildInC, markIn, markInC, linesOf, subPartLinesOfC };
};

describe('a sub-part an exploration variant builds', () => {
  afterEach(() => vi.restoreAllMocks());

  // Badges the hero builds itself while the SDK has a badge are a rebuild, and the check names the SDK part even without a mark.
  it('rejects an unmarked rebuild of an SDK part and names it', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-badges', partSource('<span class="tf-hero-badge">Neu</span>'));

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c builds components/hero-badges, whose name matches components/badge of sdk - embed @system/components/badge, or state the difference: design sketch sub-part elements/hero components/hero-badges --variant c --not-rebuild-of sdk:badge "<what it is that badge is not>" --by <model id>',
    ]);
  });

  // A mark alone is no licence to rebuild a part the product has: it needs a stated difference.
  it('rejects a marked rebuild of a project part without a stated difference and names it', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-rating', partSource('<span class="tf-hero-rating">4,5</span>'));
    hero.markInC(['components/hero-rating']);

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c builds components/hero-rating, whose name matches components/rating of tomflix - embed @system/components/rating, or state the difference: design sketch sub-part elements/hero components/hero-rating --variant c --not-rebuild-of tomflix:rating "<what it is that rating is not>" --by <model id>',
    ]);
  });

  // A new part that draws the SDK badge inside it uses the existing part instead of rebuilding it.
  it('accepts a new part that embeds the existing part its name ends in', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-badges', partSource('<et-badge>Neu</et-badge><et-badge>4K</et-badge>'));
    hero.markInC(['components/hero-badges']);

    expect(hero.subPartLinesOfC()).toEqual([]);
  });

  // A mark names a new part the variant builds, so a mark on an existing part or on a part the variant lacks is refused.
  it('rejects a mark on an existing part and a mark with nothing built', () => {
    const hero = tomflixHero();

    hero.markInC(['components/badge', 'components/hero-slider']);

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c marks components/badge as a sub-part, but the product has components/badge - a sub-part is a new part; change components/badge in a sketch of its own',
      'variant c marks components/hero-slider as a sub-part but builds no components/hero-slider - build it in c/components/hero-slider/ or drop the mark',
    ]);
  });

  // The agent marks a sub-part with name and layer through the sketch command, which refuses a key the target cannot embed and drops a mark on --remove.
  it('marks and unmarks a sub-part by its layer and name', async () => {
    const hero = tomflixHero();
    const lines: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line) => void lines.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation((line) => void lines.push(String(line)));

    const sketch = (...argv: string[]) =>
      designSketch({ target: hero.target, argv: [...argv, '--by', 'claude-opus-5-5'], invocation: 'et design' });

    expect(await sketch('sub-part', 'elements/hero', 'pages/hero-page', '--variant', 'c')).toBe(1);
    expect(await sketch('sub-part', 'elements/hero', 'components/hero-slider', '--variant', 'c')).toBe(0);
    expect(hero.reread().variantInfo['c']?.subParts).toEqual(['components/hero-slider']);
    expect(await sketch('sub-part', 'elements/hero', 'components/hero-slider', '--variant', 'c', '--remove')).toBe(0);
    expect(hero.reread().variantInfo['c']?.subParts).toBeUndefined();
    expect(lines).toContain('a sketch on elements/hero cannot embed a part of pages');
  });
  // A stated difference from the matched part accepts a marked sub-part whose name only resembles it; a difference from another part does not.
  it('accepts a marked rebuild with a stated difference from the matched part', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-rating', partSource('<span class="tf-hero-rating">4,5</span>'));
    hero.markInC(
      ['components/hero-rating'],
      [{ part: 'components/hero-rating', of: 'sdk:badge', difference: 'a score, not a label' }],
    );
    expect(hero.subPartLinesOfC()).toHaveLength(1);

    hero.markInC(
      ['components/hero-rating'],
      [{ part: 'components/hero-rating', of: 'tomflix:rating', difference: 'an age rating, not stars' }],
    );
    expect(hero.subPartLinesOfC()).toEqual([]);
  });

  // Variants of a composition may differ in a sub-part every variant that builds it marks, so an exploration can vary it.
  it('lets the variants differ in a sub-part they all mark', () => {
    const hero = tomflixHero();
    const heroWithSlider = partSource(
      '<section class="tf-hero"><tf-hero-slider></tf-hero-slider></section>',
      "import '@system/components/hero-slider';",
    );

    for (const variant of ['a', 'b', 'c']) {
      hero.buildIn(variant, 'elements/hero', heroWithSlider);
      hero.buildIn(variant, 'components/hero-slider', partSource(`<div class="tf-hero-slider">${variant}</div>`));
    }

    expect(hero.linesOf('a').some((line) => line.includes('differ in components/hero-slider'))).toBe(true);

    for (const variant of ['a', 'b', 'c']) hero.markIn(variant, ['components/hero-slider']);

    expect(hero.linesOf('a').filter((line) => line.includes('hero-slider'))).toEqual([]);
  });

  // A composition variant that builds a new part without marking it names the command that marks it.
  it('rejects an unmarked new part in a composition variant and names sketch sub-part', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-poster', partSource('<img class="tf-hero-poster" alt="" />'));

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c builds components/hero-poster, a new part it does not mark - mark it with design sketch sub-part elements/hero components/hero-poster --variant c --by <model id>',
    ]);
  });

  // A ready sketch is final, so a changed mark moves it back to in progress, by the command and by a hand edit alike.
  it('moves a ready sketch back to in progress when a mark changes', async () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-poster', partSource('<img class="tf-hero-poster" alt="" />'));

    const readied = () => {
      const sketch = hero.reread();
      const readyContent = Object.fromEntries(
        sketch.variants.map((variant) => [variant, variantContentHashOf(sketch, variant)]),
      );

      writeSketchFile({ ...sketch, status: 'ready', readyContent }, { base: sketch });
    };

    readied();
    hero.markInC(['components/hero-poster']);
    expect(changedSinceReadyOf(hero.reread())).toEqual(['c']);

    hero.markInC([]);
    readied();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(
      await designSketch({
        target: hero.target,
        argv: ['sub-part', 'elements/hero', 'components/hero-poster', '--variant', 'c', '--by', 'claude-opus-5-5'],
        invocation: 'et design',
      }),
    ).toBe(0);
    expect(hero.reread().status).toBe('in progress');
  });

  // The agent states the difference through the command, which keeps it with the mark and drops it on --remove.
  it('records a stated difference with the mark', async () => {
    const hero = tomflixHero();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const sketch = (...argv: string[]) =>
      designSketch({ target: hero.target, argv: [...argv, '--by', 'claude-opus-5-5'], invocation: 'et design' });
    const slider = ['sub-part', 'elements/hero', 'components/hero-slider'];

    expect(await sketch(...slider, '--variant', 'c', '--not-rebuild-of', 'sdk:slider')).toBe(1);
    expect(
      await sketch(...slider, 'poster carousel, no value input', '--variant', 'c', '--not-rebuild-of', 'sdk:slider'),
    ).toBe(0);
    expect(hero.reread().variantInfo['c']?.notRebuilds).toEqual([
      { part: 'components/hero-slider', of: 'sdk:slider', difference: 'poster carousel, no value input' },
    ]);
    expect(await sketch(...slider, '--variant', 'c', '--remove')).toBe(0);
    expect(hero.reread().variantInfo['c']?.notRebuilds).toBeUndefined();
  });

  // The tomflix hero drew its badges as inline spans with no part of their own (lines 35, 58 and 79 of the reported kit.ts), so the check reads the target's own markup.
  it('rejects a badge the hero draws inline and names the SDK badge', () => {
    const hero = tomflixHero();

    hero.buildInC('elements/hero', partSource(TOMFLIX_INLINE_BADGES));

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c draws ${FIXTURE.badge} inline in elements/hero, whose name matches components/badge of sdk - embed @system/components/badge, or state the difference: design sketch sub-part elements/hero elements/hero --variant c --not-rebuild-of sdk:badge "<what it is that badge is not>" --by <model id>',
    ]);
  });

  it('rejects a literal badge the hero draws in the root shape of the SDK badge and names it', () => {
    const hero = tomflixHero();

    hero.buildInC('elements/hero', partSource(TOMFLIX_LITERAL_BADGE));

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c draws <span class="tsh-badge"> inline in elements/hero, whose name matches components/badge of sdk - embed @system/components/badge, or state the difference: design sketch sub-part elements/hero elements/hero --variant c --not-rebuild-of sdk:badge "<what it is that badge is not>" --by <model id>',
    ]);

    hero.markInC([], [{ part: 'elements/hero', of: 'sdk:badge', difference: 'a poster corner tag, no pill' }]);
    expect(hero.subPartLinesOfC()).toEqual([]);
  });

  it('accepts caption text, an empty element and a group in the badge class pattern', () => {
    const hero = tomflixHero();

    hero.buildInC(
      'elements/hero',
      partSource(
        `${TOMFLIX_CAPTION_TAGS}<span class="tsh-badge"></span><span class="tsh-badges">${TOMFLIX_CAPTION_TAGS}</span>`,
      ),
    );

    expect(hero.subPartLinesOfC()).toEqual([]);
  });

  // An inline rebuild has no part folder to mark, so the command records the stated difference on the target itself and the check accepts it.
  it('accepts an inline rebuild in the target with a stated difference', async () => {
    const hero = tomflixHero();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hero.buildInC('elements/hero', partSource(TOMFLIX_INLINE_BADGES));

    const stated = await designSketch({
      target: hero.target,
      argv: [
        ...['sub-part', 'elements/hero', 'elements/hero', 'a plain caption, no pill'],
        ...['--variant', 'c', '--not-rebuild-of', 'sdk:badge', '--by', 'claude-opus-5-5'],
      ],
      invocation: 'et design',
    });

    expect(stated).toBe(0);
    expect(hero.reread().variantInfo['c']).toMatchObject({
      notRebuilds: [{ part: 'elements/hero', of: 'sdk:badge', difference: 'a plain caption, no pill' }],
    });
    expect(hero.reread().variantInfo['c']?.subParts).toBeUndefined();
    expect(hero.subPartLinesOfC()).toEqual([]);
  });

  // A value in an attribute, inside the embedded et-badge, or imported whole from another part is no inline rebuild.
  it('accepts a matching value in an attribute, inside the embedded part or imported whole', () => {
    const hero = tomflixHero();

    hero.buildInC('elements/hero', partSource('<img alt="${FIXTURE.badge}" src="x.png" />'));
    expect(hero.subPartLinesOfC()).toEqual([]);

    hero.buildInC('elements/hero', partSource('<et-badge>${FIXTURE.badge}</et-badge>'));
    expect(hero.subPartLinesOfC()).toEqual([]);

    hero.buildInC(
      'elements/hero',
      partSource('<div>${liveBadge}</div>', "import { liveBadge } from '@system/elements/canvas-frames';"),
    );
    expect(hero.subPartLinesOfC()).toEqual([]);
  });
});
