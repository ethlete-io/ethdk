import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migration, { CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH } from './migration';

const FILE = 'apps/web/src/app/app.config.ts';

describe('migrate-contentful-default-components', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const run = async (content: string) => {
    tree.write(FILE, content);
    await migration(tree, { skipFormat: true });

    return tree.read(FILE, 'utf-8');
  };

  it('spreads the constant into a call without arguments', async () => {
    const result = await run(
      ["import { provideContentfulConfig } from '@ethlete/contentful';", '', 'provideContentfulConfig();'].join('\n'),
    );

    expect(result).toContain(
      "import { CONTENTFUL_DEFAULT_COMPONENTS, provideContentfulConfig } from '@ethlete/contentful';",
    );
    expect(result).toContain('provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });');
    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it('spreads the constant into an empty and a filled literal', async () => {
    const result = await run(
      [
        "import { ContentfulImports, provideContentfulConfig } from '@ethlete/contentful';",
        '',
        'provideContentfulConfig({});',
        'provideContentfulConfig({',
        "  internalHosts: ['example.com'],",
        '});',
      ].join('\n'),
    );

    expect(result).toContain('provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });');
    expect(result).toContain(
      "provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS, internalHosts: ['example.com'],",
    );
    expect(result).toContain(
      "import { CONTENTFUL_DEFAULT_COMPONENTS, ContentfulImports, provideContentfulConfig } from '@ethlete/contentful';",
    );
  });

  it('reports a config that is not a literal', async () => {
    const content = [
      "import { provideContentfulConfig } from '@ethlete/contentful';",
      '',
      'provideContentfulConfig(CONFIG);',
    ].join('\n');

    expect(await run(content)).toBe(content);

    const report = tree.read(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH, 'utf-8');

    expect(report).toContain(`${FILE}:3`);
    expect(report).toContain('`provideContentfulConfig(CONFIG)` is not a literal');
  });

  it('spreads into a literal that names its own components and reports it', async () => {
    const result = await run(
      [
        "import { provideContentfulConfig } from '@ethlete/contentful';",
        '',
        'provideContentfulConfig({ customComponents: { a: A }, components: { image: MyImage } });',
      ].join('\n'),
    );

    expect(result).toContain('provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS, customComponents');
    expect(tree.read(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH, 'utf-8')).toContain('names its own `components`');
  });

  it('does not report customComponents as own components', async () => {
    await run(
      [
        "import { provideContentfulConfig } from '@ethlete/contentful';",
        '',
        'provideContentfulConfig({ customComponents: { components: A } });',
      ].join('\n'),
    );

    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it('leaves a file alone that already spreads the constant or imports nothing from the package', async () => {
    const migrated = [
      "import { CONTENTFUL_DEFAULT_COMPONENTS, provideContentfulConfig } from '@ethlete/contentful';",
      '',
      'provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });',
    ].join('\n');
    const unrelated = ["import { provideContentfulConfig } from './local';", '', 'provideContentfulConfig();'].join(
      '\n',
    );

    expect(await run(migrated)).toBe(migrated);
    expect(await run(unrelated)).toBe(unrelated);
    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it.each(['ContentfulRichTextRendererComponent', 'ContentfulImports'])(
    'reports a file importing %s when the workspace never provides a config',
    async (name) => {
      const component = 'apps/web/src/app/article.component.ts';

      tree.write(component, `import { ${name} } from '@ethlete/contentful';\n`);
      await migration(tree, { skipFormat: true });

      const report = tree.read(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH, 'utf-8');

      expect(report).toContain(`${component}:1`);
      expect(report).toContain('provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS })');
    },
  );

  it('does not report a renderer import when another file provides a config', async () => {
    tree.write('apps/web/src/app/article.component.ts', "import { ContentfulImports } from '@ethlete/contentful';\n");

    await run(
      [
        "import { CONTENTFUL_DEFAULT_COMPONENTS, provideContentfulConfig } from '@ethlete/contentful';",
        '',
        'provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });',
      ].join('\n'),
    );

    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });
});
