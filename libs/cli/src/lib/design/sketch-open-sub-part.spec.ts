import { mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from './design-config';
import {
  CONFIG,
  opened,
  SHELL_USING_TAB_BAR,
  tabBarSource,
  tomflixShellAndTabBar,
  write,
} from './open-sub-part.fixtures';
import { resolveProduct } from './system/resolve-product';
import { variantProblemsOf } from './system/sketch/check-sketches';
import { mergeRefusalOf } from './system/sketch/merge';
import { findSketch, parseTarget, Sketch, variantDirOf, writeSketchFile } from './system/sketch/sketch';
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

    expect(messages).toEqual([
      { variant: 'a', messages: [differs] },
      { variant: 'b', messages: [differs] },
    ]);
  });
});
