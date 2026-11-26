import { cpSync, mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from './design-config';
import {
  CONFIG,
  opened,
  SHELL_USING_TAB_BAR,
  TAB_BAR_USING_TAB_ICON,
  TAB_ICON_SOURCE,
  tabBarSource,
  tomflixShellAndTabBar,
  write,
} from './open-sub-part.fixtures';
import { resolveProduct } from './system/resolve-product';
import { typecheckVariant, variantProblemsOf } from './system/sketch/check-sketches';
import { mergeRefusalOf } from './system/sketch/merge';
import {
  createSketch,
  findSketch,
  parseTarget,
  sharedDirOf,
  Sketch,
  variantDirOf,
  writeSketchFile,
} from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

const reread = (target: string, key: string): Sketch => {
  const parsed = parseTarget(key);
  const found =
    typeof parsed === 'string'
      ? null
      : findSketch({ productDir: join(target, DESIGN_DIR, 'tomflix'), product: 'tomflix', sketch: parsed });

  if (!found || typeof found === 'string') throw new Error(`no sketch on ${key}`);

  return found;
};

describe('a composition sketch that uses a part of another open sketch', () => {
  // The tomflix shell draws the new tab bar of the open components/tab-bar sketch in the variant its agent recommends, with no import problem.
  it('draws the new part from the variant the open sketch recommends', () => {
    const { target, product, shell, tabBar } = tomflixShellAndTabBar({ recommend: 'b' });
    const system = createSystemModules({ target, config: { products: { tomflix: CONFIG } } });
    const shellFile = resolve(variantDirOf(shell, 'a'), 'elements/shell-app/shell-app.ts');
    const resolved = system.resolveId(
      '@system/components/tab-bar',
      productModuleIdOf({ file: shellFile, product: 'tomflix', sketch: { target: shell.target, variant: 'a' } }),
    );

    expect(resolved).toBe(
      productModuleIdOf({
        file: resolve(variantDirOf(tabBar, 'b'), 'components/tab-bar/tab-bar.ts'),
        product: 'tomflix',
        sketch: { target: 'components/tab-bar', variant: 'b' },
      }),
    );
    expect(
      variantProblemsOf({ product: product(), sketch: shell }).flatMap(({ problems }) =>
        problems.map((p) => p.message),
      ),
    ).toEqual([]);
  });

  // The lent tab bar draws a tab icon that is new in a third open sketch: the shell draws both, with no import problem.
  it('draws a part the lent part imports from the open sketch that holds it', () => {
    const { target, product, shell, tabBar } = tomflixShellAndTabBar({ recommend: 'a' });
    const tabIcon = opened(product(), 'components/tab-icon');

    for (const variant of tabIcon.variants)
      write(
        resolve(variantDirOf(tabIcon, variant), 'components/tab-icon/tab-icon.ts'),
        TAB_ICON_SOURCE.replace('NAME', variant),
      );
    writeSketchFile({ ...tabIcon, recommended: 'b' }, { base: tabIcon });
    write(resolve(variantDirOf(tabBar, 'a'), 'components/tab-bar/tab-bar.ts'), TAB_BAR_USING_TAB_ICON);

    const system = createSystemModules({ target, config: { products: { tomflix: CONFIG } } });
    const lentBar = system.resolveId(
      '@system/components/tab-bar',
      productModuleIdOf({
        file: resolve(variantDirOf(shell, 'a'), 'elements/shell-app/shell-app.ts'),
        product: 'tomflix',
        sketch: { target: shell.target, variant: 'a' },
      }),
    );

    expect(system.resolveId('@system/components/tab-icon', lentBar ?? '')).toBe(
      productModuleIdOf({
        file: resolve(variantDirOf(tabIcon, 'b'), 'components/tab-icon/tab-icon.ts'),
        product: 'tomflix',
        sketch: { target: 'components/tab-icon', variant: 'b' },
      }),
    );
    expect(
      variantProblemsOf({ product: product(), sketch: reread(target, shell.target) }).flatMap(({ problems }) =>
        problems.map((problem) => problem.message),
      ),
    ).toEqual([]);
    expect(
      typecheckVariant({ target, product: product(), sketch: reread(target, shell.target), variant: 'a' }),
    ).toEqual({
      kind: 'ok',
    });
  }, 120_000);

  // Until the agent of the tab bar sketch recommends a variant, the shell check names the command that does it.
  it('names sketch recommend while the open sketch recommends no variant', () => {
    const { product, shell } = tomflixShellAndTabBar({});
    const messages = variantProblemsOf({ product: product(), sketch: shell }).flatMap(({ problems }) =>
      problems.map((problem) => problem.message),
    );

    expect(messages).toContain(
      'components/tab-bar is drawn in the open sketch on components/tab-bar, which recommends no variant - run design sketch recommend components/tab-bar --variant <key> --by <model id>',
    );
  });

  // A picked shell variant that still draws the tab bar from its open sketch cannot merge before the tab bar does.
  it('refuses the merge of the composition before the sketch it borrows from', () => {
    const { target, product, shell } = tomflixShellAndTabBar({ recommend: 'a' });
    const picked = {
      ...shell,
      status: 'ready' as const,
      decision: { kind: 'pick' as const, variant: 'a', decidedAt: new Date().toISOString() },
    };

    writeSketchFile(picked, { base: shell });

    expect(mergeRefusalOf({ product: product(), sketch: reread(target, shell.target) })).toBe(
      'elements/shell-app variant a uses components/tab-bar from the open sketch on components/tab-bar - merge that sketch first',
    );
  });
});

const SDK_BUTTON = resolve(__dirname, '../../../../../.ethlete/design/sdk/components/button');
const INSTALLED = 'node_modules/@ethlete/components/design';

const BUTTON_KIT_SOURCE = `export const tfButton = (label: string) => \`<button class="tf-button">\${label}</button>\`;
`;

const TF_BUTTON_SOURCE = `import { definePart, drawing } from '@design-system';
import { tfButton } from '@shared/button-kit';

type Props = Record<string, never>;

export { tfButton };

export default definePart<Props>({
  note: 'Der Tomflix-Knopf.',
  states: { abspielen: {} },
  describe: { abspielen: 'The play button; check that it reads as the main action.' },
  render: () => drawing({ body: tfButton('Abspielen'), styles: '' }),
});
`;

const HERO_DATA_SOURCE = `import { tfButton } from '@system/components/button';

export const heroActions = () => tfButton('Abspielen');
`;

const HERO_STUB_SOURCE = `import { definePart, drawing } from '@design-system';

type Props = Record<string, never>;

export default definePart<Props>({
  note: '',
  states: { default: {} },
  describe: { default: '' },
  render: () => drawing({ body: '<div class="hero">hero</div>', styles: '' }),
});
`;

const HERO_USING_TF_BUTTON = `import { definePart, drawing } from '@design-system';
import { tfButton } from '@system/components/button';

type Props = Record<string, never>;

export default definePart<Props>({
  note: 'Szenenbild mit Titel und Knopf.',
  states: { dune: {} },
  describe: { dune: 'The hero of Dune with its play button; check that the button stands out.' },
  render: () => drawing({ body: \`<section class="tf-hero">\${tfButton('Abspielen')}</section>\`, styles: '' }),
});
`;

describe('a composition sketch that uses an SDK part another open sketch overrides', () => {
  // Client run 0236: hero variant a and the hero's shared data import tfButton from the open override sketch of the SDK button, which recommends a and builds it in its own shared folder; variant b is still a stub.
  it('draws the override from the variant the open sketch recommends', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-open-override-'));
    const config = { styles: [], base: '@ethlete/components', schemes: ['dark' as const] };

    write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: config } }));
    mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });
    cpSync(SDK_BUTTON, join(target, INSTALLED, 'sdk/components/button'), { recursive: true });
    write(
      join(target, INSTALLED, 'config.json'),
      JSON.stringify({ products: { sdk: { presets: { desktop: { width: 1440 } } } } }),
    );

    const product = () => resolveProduct({ target, name: 'tomflix', config });
    const parsed = parseTarget('components/button');
    const button =
      typeof parsed === 'string'
        ? parsed
        : createSketch({ product: product(), sketch: parsed, variants: ['a', 'b'], merge: 'override' });

    if (typeof button === 'string') throw new Error(button);

    for (const variant of button.variants)
      write(resolve(variantDirOf(button, variant), 'components/button/button.ts'), TF_BUTTON_SOURCE);
    write(resolve(sharedDirOf(button), 'button-kit.ts'), BUTTON_KIT_SOURCE);
    writeSketchFile({ ...button, recommended: 'a' }, { base: button });

    const hero = opened(product(), 'elements/hero');

    write(resolve(variantDirOf(hero, 'a'), 'elements/hero/hero.ts'), HERO_USING_TF_BUTTON);
    write(resolve(variantDirOf(hero, 'b'), 'elements/hero/hero.ts'), HERO_STUB_SOURCE);
    write(resolve(sharedDirOf(hero), 'hero-data.ts'), HERO_DATA_SOURCE);

    const system = createSystemModules({ target, config: { products: { tomflix: config } } });

    expect(
      system.resolveId(
        '@system/components/button',
        productModuleIdOf({
          file: resolve(variantDirOf(hero, 'a'), 'elements/hero/hero.ts'),
          product: 'tomflix',
          sketch: { target: hero.target, variant: 'a' },
        }),
      ),
    ).toBe(
      productModuleIdOf({
        file: resolve(variantDirOf(button, 'a'), 'components/button/button.ts'),
        product: 'tomflix',
        sketch: { target: 'components/button', variant: 'a' },
      }),
    );
    for (const variant of hero.variants)
      expect(typecheckVariant({ target, product: product(), sketch: reread(target, hero.target), variant })).toEqual({
        kind: 'ok',
      });
  }, 120_000);
});

describe('a composition sketch whose variants differ in a sub-part', () => {
  // Each tomflix shell variant drawing its own tab bar fails the check, which names the fix: change the tab bar in its own sketch.
  it('rejects variants that hold different copies of a part below the composition', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-sub-part-differs-'));

    write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: CONFIG } }));
    mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });

    const product = () => resolveProduct({ target, name: 'tomflix', config: CONFIG });
    const shell = opened(product(), 'elements/shell-app');

    for (const [variant, label] of [
      ['a', 'section'],
      ['b', 'section.toUpperCase()'],
    ] as const) {
      write(resolve(variantDirOf(shell, variant), 'elements/shell-app/shell-app.ts'), SHELL_USING_TAB_BAR);
      write(resolve(variantDirOf(shell, variant), 'components/tab-bar/tab-bar.ts'), tabBarSource(label));
    }

    const messages = variantProblemsOf({ product: product(), sketch: shell }).map(({ variant, problems }) => ({
      variant,
      messages: problems.map((problem) => problem.message),
    }));
    const differs =
      "the variants of elements/shell-app differ in components/tab-bar - a composition's variants differ only in arrangement: change components/tab-bar in a sketch of its own and import it as @system/components/tab-bar";

    const unmarked = (variant: string) =>
      `variant ${variant} builds components/tab-bar, a new part it does not mark - mark it with design sketch sub-part elements/shell-app components/tab-bar --variant ${variant} --by <model id>`;

    expect(messages).toEqual([
      { variant: 'a', messages: [differs, unmarked('a')] },
      { variant: 'b', messages: [differs, unmarked('b')] },
    ]);
  });
});
