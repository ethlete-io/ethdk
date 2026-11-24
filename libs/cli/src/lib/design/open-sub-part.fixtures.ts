import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { DESIGN_DIR } from './design-config';
import { resolveProduct } from './system/resolve-product';
import { createSketch, parseTarget, variantDirOf, writeSketchFile } from './system/sketch/sketch';

export const CONFIG = { styles: [], schemes: ['dark' as const] };

export const tabBarSource = (label: string) => `import { definePart, drawing } from '@design-system';
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

export const SHELL_USING_TAB_BAR = `import { definePart, drawing } from '@design-system';
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

export const write = (file: string, text: string) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text, 'utf8');
};

export const opened = (product: ReturnType<typeof resolveProduct>, key: string) => {
  const parsed = parseTarget(key);
  const created = typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

  if (typeof created === 'string') throw new Error(created);

  return created;
};

export const tomflixShellAndTabBar = (options: { recommend?: string }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-open-sub-part-'));

  write(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: CONFIG } }));
  mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });

  const product = () => resolveProduct({ target, name: 'tomflix', config: CONFIG });
  const tabBar = opened(product(), 'components/tab-bar');

  write(resolve(variantDirOf(tabBar, 'a'), 'components/tab-bar/tab-bar.ts'), tabBarSource('section'));
  write(resolve(variantDirOf(tabBar, 'b'), 'components/tab-bar/tab-bar.ts'), tabBarSource('section.toUpperCase()'));
  if (options.recommend) writeSketchFile({ ...tabBar, recommended: options.recommend }, { base: tabBar });

  const shell = opened(product(), 'elements/shell-app');

  for (const variant of shell.variants)
    write(resolve(variantDirOf(shell, variant), 'elements/shell-app/shell-app.ts'), SHELL_USING_TAB_BAR);

  return { target, product, shell, tabBar };
};
