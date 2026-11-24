import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { resolveProduct } from './system/resolve-product';
import { variantProblemsOf } from './system/sketch/check-sketches';
import { mergeRefusalOf } from './system/sketch/merge';
import { createSketch, findSketch, parseTarget, Sketch, variantDirOf, writeSketchFile } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

const CONFIG = { styles: [], schemes: ['dark' as const] };

const tabBarSource = (label: string) => `import { definePart, drawing } from '@design-system';
import styles from './tab-bar.css?inline';

type Props = { active: string };

const sections = ['start', 'filme', 'serien', 'merkliste'];

export default definePart<Props>({
  note: 'Die Reiter unten am Telefon.',
  states: { start: { active: 'start' } },
  describe: { start: 'Four tabs with Start active; check that the active tab stands out.' },
  render: ({ active }) =>
    drawing({
      body: \`<nav aria-label="Hauptnavigation" class="tf-tab-bar">\${sections
        .map((section) => \`<a href="#"\${section === active ? ' aria-current="page"' : ''}>\${${label}}</a>\`)
        .join('')}</nav>\`,
      styles,
    }),
});
`;

const SHELL_USING_TAB_BAR = `import { definePart, drawing } from '@design-system';
import tabBar from '@system/components/tab-bar';
import styles from './shell-app.css?inline';

type Props = Record<string, never>;

export default definePart<Props>({
  note: 'Marke oben, Inhalt, die Reiter unten.',
  states: { phone: {} },
  describe: { phone: 'The shell at 390 wide with the tab bar at the bottom; check that the tabs fit.' },
  render: async () => {
    const bar = await tabBar.render({ active: 'start' });

    return drawing({ body: \`<div class="tf-shell"><main></main>\${bar.body}</div>\`, styles: \`\${styles}\${bar.styles}\` });
  },
});
`;

const write = (file: string, text: string) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text, 'utf8');
};

const opened = (product: ReturnType<typeof resolveProduct>, key: string, variants: string[]) => {
  const parsed = parseTarget(key);
  const created = typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants });

  if (typeof created === 'string') throw new Error(created);

  return created;
};

const tomflixShellAndTabBar = (options: { recommend?: string }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-open-sub-part-'));

  write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: CONFIG } }));
  mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });

  const product = () => resolveProduct({ target, name: 'tomflix', config: CONFIG });
  const tabBar = opened(product(), 'components/tab-bar', ['a', 'b']);

  write(resolve(variantDirOf(tabBar, 'a'), 'components/tab-bar/tab-bar.ts'), tabBarSource('section'));
  write(resolve(variantDirOf(tabBar, 'b'), 'components/tab-bar/tab-bar.ts'), tabBarSource('section.toUpperCase()'));
  if (options.recommend) writeSketchFile({ ...tabBar, recommended: options.recommend }, { base: tabBar });

  const shell = opened(product(), 'elements/shell-app', ['a', 'b']);

  for (const variant of shell.variants)
    write(resolve(variantDirOf(shell, variant), 'elements/shell-app/shell-app.ts'), SHELL_USING_TAB_BAR);

  return { target, product, shell, tabBar };
};

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

  // Until the agent of the tab bar sketch recommends a variant, the shell check names the command that does it.
  it('names sketch recommend while the open sketch recommends no variant', () => {
    const { product, shell } = tomflixShellAndTabBar({});
    const messages = variantProblemsOf({ product: product(), sketch: shell }).flatMap(({ problems }) =>
      problems.map((problem) => problem.message),
    );

    expect(messages).toContain(
      'components/tab-bar is new in the open sketch on components/tab-bar, which recommends no variant - run design sketch recommend components/tab-bar --variant <key> --by <model id>',
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

describe('a composition sketch whose variants differ in a sub-part', () => {
  // Each tomflix shell variant drawing its own tab bar fails the check, which names the fix: change the tab bar in its own sketch.
  it('rejects variants that hold different copies of a part below the composition', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-sub-part-differs-'));

    write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: CONFIG } }));
    mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });

    const product = () => resolveProduct({ target, name: 'tomflix', config: CONFIG });
    const shell = opened(product(), 'elements/shell-app', ['a', 'b']);

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

    expect(messages).toEqual([
      { variant: 'a', messages: [differs] },
      { variant: 'b', messages: [differs] },
    ]);
  });
});
