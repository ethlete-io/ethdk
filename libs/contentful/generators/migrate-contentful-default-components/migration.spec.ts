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

  it('adds the feature to a call without arguments', async () => {
    const result = await run(
      ["import { provideContentfulConfig } from '@ethlete/contentful';", '', 'provideContentfulConfig();'].join('\n'),
    );

    expect(result).toContain(
      "import { withContentfulDefaultComponents, provideContentfulConfig } from '@ethlete/contentful';",
    );
    expect(result).toContain('provideContentfulConfig({ features: [withContentfulDefaultComponents()] });');
    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it('adds the feature to an empty and a filled literal', async () => {
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

    expect(result).toContain('provideContentfulConfig({ features: [withContentfulDefaultComponents()] });');
    expect(result).toContain(
      "provideContentfulConfig({ features: [withContentfulDefaultComponents()], internalHosts: ['example.com'],",
    );
    expect(result).toContain(
      "import { withContentfulDefaultComponents, ContentfulImports, provideContentfulConfig } from '@ethlete/contentful';",
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

  it('reports a literal that names its own features', async () => {
    const content = [
      "import { provideContentfulConfig } from '@ethlete/contentful';",
      '',
      'provideContentfulConfig({ features: FEATURES });',
    ].join('\n');

    expect(await run(content)).toBe(content);
    expect(tree.read(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH, 'utf-8')).toContain('names its own `features`');
  });

  it('leaves a file alone that already uses the feature or imports nothing from the package', async () => {
    const migrated = [
      "import { provideContentfulConfig, withContentfulDefaultComponents } from '@ethlete/contentful';",
      '',
      'provideContentfulConfig({ features: [withContentfulDefaultComponents()] });',
    ].join('\n');
    const unrelated = ["import { provideContentfulConfig } from './local';", '', 'provideContentfulConfig();'].join(
      '\n',
    );

    expect(await run(migrated)).toBe(migrated);
    expect(await run(unrelated)).toBe(unrelated);
    expect(tree.exists(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });
});
