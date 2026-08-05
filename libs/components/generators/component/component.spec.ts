import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { componentNames } from './component-names';
import generate from './generator';
import { insertBarrelExport, insertDocsSidebarEntry, nextErrorCodeBlock } from './workspace-edits';

const SIDEBAR = `export default defineConfig({
  themeConfig: {
    sidebar: {
      '/components/': [
        {
          text: 'Layout & structure',
          items: [
            { text: 'Accordion', link: '/components/accordion' },
            { text: 'Breadcrumb', link: '/components/breadcrumb' },
            { text: 'Card', link: '/components/card' },
            { text: 'Divider', link: '/components/divider' },
            { text: 'Grid', link: '/components/grid' },
            { text: 'Masonry', link: '/components/masonry' },
            { text: 'Scrollable', link: '/components/scrollable' },
            { text: 'Standings', link: '/components/standings' },
            { text: 'Sport UI recipes', link: '/components/sport-recipes' },
            { text: 'Table', link: '/components/table' },
            { text: 'Tree', link: '/components/tree' },
          ],
        },
        {
          text: 'Forms & inputs',
          items: [
            { text: 'Overview', link: '/components/forms' },
            { text: 'Select', link: '/components/select' },
            { text: 'Cascader', link: '/components/cascader' },
          ],
        },
      ],
    },
  },
});
`;

const ARCHITECTURE_DOC = `### Code range allocation

| Range       | Domain |
| ----------- | ------ |
| 4500 – 4599 | Scheduler |
| 4600 – 4699 | Tree |

Add new domains by claiming the next free hundred block (next free: **4700**
onward).
`;

const setup = () => {
  const tree = createTreeWithEmptyWorkspace();

  addProjectConfiguration(tree, 'components', { root: 'libs/components', sourceRoot: 'libs/components/src' });
  tree.write('libs/components/src/index.ts', `export * from './lib/accordion';\nexport * from './lib/tree';\n`);
  tree.write('libs/components/src/lib/tree/tree-errors.ts', `// codes 4600-4699\n`);
  tree.write('apps/docs/components/divider.md', '# Divider\n');
  tree.write('apps/docs/.vitepress/config.mts', SIDEBAR);
  tree.write('docs/COMPONENT-ARCHITECTURE.md', ARCHITECTURE_DOC);

  return tree;
};

const read = (tree: Tree, path: string) => tree.read(path, 'utf-8') ?? '';

describe('componentNames', () => {
  it('derives every naming form from a kebab-case domain', () => {
    expect(componentNames('stat-tile')).toEqual({
      fileName: 'stat-tile',
      className: 'StatTile',
      constantName: 'STAT_TILE',
      elementSelector: 'et-stat-tile',
      attributeSelector: 'etStatTile',
      title: 'Stat tile',
      storyIdPrefix: 'components-stat-tile',
    });
  });

  it('normalizes other casings', () => {
    expect(componentNames('StatTile').fileName).toBe('stat-tile');
  });

  it('rejects a name that cannot be a selector', () => {
    expect(() => componentNames('1tile')).toThrow(/kebab-case/);
  });
});

describe('insertBarrelExport', () => {
  it('inserts alphabetically', () => {
    const result = insertBarrelExport(`export * from './lib/accordion';\nexport * from './lib/tree';\n`, 'divider');

    expect(result).toBe(
      `export * from './lib/accordion';\nexport * from './lib/divider';\nexport * from './lib/tree';\n`,
    );
  });

  it('appends past the last export when the name sorts last', () => {
    const result = insertBarrelExport(`export * from './lib/accordion';\n`, 'divider');

    expect(result).toBe(`export * from './lib/accordion';\nexport * from './lib/divider';\n`);
  });

  it('is idempotent', () => {
    const once = insertBarrelExport(`export * from './lib/accordion';\n`, 'divider');

    expect(insertBarrelExport(once, 'divider')).toBe(once);
  });
});

describe('insertDocsSidebarEntry', () => {
  it('inserts alphabetically into a group a stray pair aside', () => {
    const result = insertDocsSidebarEntry(SIDEBAR, 'Layout & structure', 'Stat tile', '/components/stat-tile');
    const lines = result.split('\n').filter((l) => l.includes('link:'));

    expect(lines[8]?.trim()).toBe(`{ text: 'Sport UI recipes', link: '/components/sport-recipes' },`);
    expect(lines[9]?.trim()).toBe(`{ text: 'Stat tile', link: '/components/stat-tile' },`);
    expect(lines[10]?.trim()).toBe(`{ text: 'Table', link: '/components/table' },`);
  });

  it('appends to a hand-ordered group', () => {
    const result = insertDocsSidebarEntry(SIDEBAR, 'Forms & inputs', 'Alpha', '/components/alpha');
    const group = result.slice(result.indexOf(`text: 'Forms & inputs'`));
    const lines = group.split('\n').filter((l) => l.includes('link:'));

    expect(lines.at(-1)?.trim()).toBe(`{ text: 'Alpha', link: '/components/alpha' },`);
  });

  it('leaves the file alone when the group is unknown', () => {
    expect(insertDocsSidebarEntry(SIDEBAR, 'Nope', 'Alpha', '/components/alpha')).toBe(SIDEBAR);
  });
});

describe('nextErrorCodeBlock', () => {
  it('takes the block after the highest allocated one', () => {
    expect(nextErrorCodeBlock(['// codes 1000-1099', '// codes 4600-4699', '// codes 3000-3099'])).toBe(4700);
  });

  it('starts at 1000 when nothing is allocated', () => {
    expect(nextErrorCodeBlock([])).toBe(1000);
  });
});

describe('component generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = setup();
  });

  it('scaffolds both tiers by default', async () => {
    await generate(tree, { name: 'stat-tile' });

    expect(tree.exists('libs/components/src/lib/stat-tile/headless/stat-tile.directive.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/headless/index.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.css')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.spec.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/stories/stat-tile.stories.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/stories/stat-tile-storybook.component.ts')).toBe(true);

    const component = read(tree, 'libs/components/src/lib/stat-tile/stat-tile.component.ts');

    expect(component).toContain(`hostDirectives: [StatTileDirective]`);
    expect(component).toContain(`selector: 'et-stat-tile'`);
    expect(read(tree, 'libs/components/src/lib/stat-tile/stat-tile.imports.ts')).toContain(
      `export const STAT_TILE_IMPORTS = [StatTileComponent, StatTileDirective] as const;`,
    );
    expect(read(tree, 'libs/components/src/lib/stat-tile/index.ts')).toBe(
      `export * from './headless';\nexport * from './stat-tile.component';\nexport * from './stat-tile.imports';\n`,
    );
  });

  it('wraps the styles in the components layer', async () => {
    await generate(tree, { name: 'stat-tile' });

    expect(read(tree, 'libs/components/src/lib/stat-tile/stat-tile.component.css')).toContain('@layer components {');
  });

  it('exports the domain from the lib barrel', async () => {
    await generate(tree, { name: 'stat-tile' });

    expect(read(tree, 'libs/components/src/index.ts')).toContain(`export * from './lib/stat-tile';`);
  });

  it('writes the docs page and its sidebar entry', async () => {
    await generate(tree, { name: 'stat-tile' });

    expect(read(tree, 'apps/docs/components/stat-tile.md')).toContain('<StoryEmbed id="components-stat-tile--default"');
    expect(read(tree, 'apps/docs/.vitepress/config.mts')).toContain(
      `{ text: 'Stat tile', link: '/components/stat-tile' },`,
    );
  });

  it('allocates the next free error code block', async () => {
    await generate(tree, { name: 'stat-tile', errors: true });

    const errors = read(tree, 'libs/components/src/lib/stat-tile/stat-tile-errors.ts');

    expect(errors).toContain('// codes 4700-4799');
    expect(errors).toContain('PLACEHOLDER: 4700');
    expect(read(tree, 'libs/components/src/lib/stat-tile/index.ts')).toContain(`export * from './stat-tile-errors';`);
  });

  it('claims the block in the architecture doc', async () => {
    await generate(tree, { name: 'stat-tile', errors: true });

    const doc = read(tree, 'docs/COMPONENT-ARCHITECTURE.md');

    expect(doc).toContain('| 4700 – 4799 | Stat tile |');
    expect(doc.indexOf('| 4700 – 4799')).toBeGreaterThan(doc.indexOf('| 4600 – 4699'));
    expect(doc).toContain('next free: **4800**');
  });

  it('leaves the architecture doc alone without --errors', async () => {
    await generate(tree, { name: 'stat-tile' });

    expect(read(tree, 'docs/COMPONENT-ARCHITECTURE.md')).toContain('next free: **4700**');
  });

  it('scaffolds a headless-only domain without a component or styles', async () => {
    await generate(tree, { name: 'stat-tile', tier: 'headless' });

    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.directive.ts')).toBe(true);
    expect(tree.exists('libs/components/src/lib/stat-tile/headless')).toBe(false);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.ts')).toBe(false);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.css')).toBe(false);
    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.directive.spec.ts')).toBe(true);
    expect(read(tree, 'libs/components/src/lib/stat-tile/stat-tile.imports.ts')).toContain(
      `[StatTileDirective] as const;`,
    );
  });

  it('scaffolds a component-only domain without a directive', async () => {
    await generate(tree, { name: 'stat-tile', tier: 'component' });

    expect(tree.exists('libs/components/src/lib/stat-tile/headless')).toBe(false);
    expect(read(tree, 'libs/components/src/lib/stat-tile/stat-tile.component.ts')).not.toContain('hostDirectives');
  });

  it('honours the opt-outs', async () => {
    await generate(tree, { name: 'stat-tile', spec: false, stories: false, docs: false });

    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.spec.ts')).toBe(false);
    expect(tree.exists('libs/components/src/lib/stat-tile/stories')).toBe(false);
    expect(tree.exists('apps/docs/components/stat-tile.md')).toBe(false);
  });

  it('refuses to overwrite an existing domain', async () => {
    tree.write('libs/components/src/lib/stat-tile/index.ts', 'export {};\n');

    await generate(tree, { name: 'stat-tile' });

    expect(tree.exists('libs/components/src/lib/stat-tile/stat-tile.component.ts')).toBe(false);
  });
});
