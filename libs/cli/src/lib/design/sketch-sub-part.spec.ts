import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { designSketch } from './sketch-command';
import { resolveProduct } from './system/resolve-product';
import { variantProblemsOf } from './system/sketch/check-sketches';
import { createSketch, findSketch, parseTarget, Sketch, variantDirOf, writeSketchFile } from './system/sketch/sketch';

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
  const buildInC = (key: string, source: string) =>
    write(resolve(variantDirOf(hero, 'c'), `${key}/${key.split('/')[1]}.ts`), source);
  const markInC = (subParts: string[]) => {
    const sketch = reread();

    writeSketchFile(
      { ...sketch, variantInfo: { ...sketch.variantInfo, c: { ...sketch.variantInfo['c'], subParts } } },
      { base: sketch },
    );
  };
  const subPartLinesOfC = () =>
    variantProblemsOf({ product: product(), sketch: reread(), productProblems: [] })
      .filter(({ variant }) => variant === 'c')
      .flatMap(({ problems }) => problems.map((problem) => problem.message))
      .filter((message) => message.includes('sub-part') || message.includes('rebuild'));

  return { target, reread, buildInC, markInC, subPartLinesOfC };
};

describe('a sub-part an exploration variant builds', () => {
  afterEach(() => vi.restoreAllMocks());

  // Badges the hero builds itself while the SDK has a badge are a rebuild, and the check names the SDK part even without a mark.
  it('rejects an unmarked rebuild of an SDK part and names it', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-badges', partSource('<span class="tf-hero-badge">Neu</span>'));

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c builds components/hero-badges, a rebuild of components/badge of sdk - embed @system/components/badge instead of building it again',
    ]);
  });

  // The mark makes a new part a sub-part, but never a licence to rebuild one the product has.
  it('rejects a marked rebuild of a project part and names it', () => {
    const hero = tomflixHero();

    hero.buildInC('components/hero-rating', partSource('<span class="tf-hero-rating">4,5</span>'));
    hero.markInC(['components/hero-rating']);

    expect(hero.subPartLinesOfC()).toEqual([
      'variant c builds components/hero-rating, a rebuild of components/rating of tomflix - embed @system/components/rating instead of building it again',
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
});
