import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import {
  addStreamConfigToAppConfig,
  addStreamOverlayImportsToFile,
  scanStreamDefaultComponentsInFile,
} from './stream-default-components';
import migrateStreamDefaultComponents, { STREAM_DEFAULT_COMPONENTS_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/app.config.ts';

describe('migrate-stream-default-components', () => {
  it('spreads the default components first into a literal config and imports them', () => {
    const { next } = scanStreamDefaultComponentsInFile(
      FILE,
      [
        "import { provideStreamConfig, StreamConsentComponent } from '@ethlete/components';",
        'export const providers = [provideStreamConfig({ consentComponent: StreamConsentComponent })];',
      ].join('\n'),
    );

    expect(next).toBe(
      [
        "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig, StreamConsentComponent } from '@ethlete/components';",
        'export const providers = [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS, consentComponent: StreamConsentComponent })];',
      ].join('\n'),
    );
  });

  it('fills an empty call', () => {
    const { next } = scanStreamDefaultComponentsInFile(
      FILE,
      "import { provideStreamConfig } from '@ethlete/components';\nprovideStreamConfig();\nprovideStreamConfig({});",
    );

    expect(next).toBe(
      "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig } from '@ethlete/components';\nprovideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });\nprovideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });",
    );
  });

  it('reports a call whose config it cannot see', () => {
    const { next, tasks, hasConfig } = scanStreamDefaultComponentsInFile(
      FILE,
      "import { provideStreamConfig } from '@ethlete/components';\n\nprovideStreamConfig(SHARED_STREAM_CONFIG);",
    );

    expect(next).toBeNull();
    expect(hasConfig).toBe(true);
    expect(tasks).toEqual([
      expect.objectContaining({ file: FILE, line: 3, message: expect.stringContaining('SHARED_STREAM_CONFIG') }),
    ]);
  });

  it('leaves a file alone that already spreads the default components', () => {
    const { next, hasConfig } = scanStreamDefaultComponentsInFile(
      FILE,
      "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig } from '@ethlete/components';\nprovideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });",
    );

    expect(next).toBeNull();
    expect(hasConfig).toBe(true);
  });

  it('leaves a provideStreamConfig that is not from @ethlete/components alone', () => {
    expect(
      scanStreamDefaultComponentsInFile(
        FILE,
        "import { provideStreamConfig } from './local';\nprovideStreamConfig({});",
      ).next,
    ).toBeNull();
  });

  it.each([
    ['<et-youtube-player-slot videoId="a" />', true],
    ['<et-twitch-player-slot src="a" />', true],
    ['<et-youtube-player videoId="a" />', false],
    ["import { STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '@ethlete/components';", true],
  ])('treats %s as a stream usage: %s', (content, expected) => {
    expect(scanStreamDefaultComponentsInFile('apps/shop/src/app/stream.html', content).usesStream).toBe(expected);
  });

  it('rewrites the config and reports nothing when the app has one', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/app/stream.component.html', '<et-youtube-player-slot videoId="a" />\n');
    tree.write(
      'apps/shop/src/app/app.config.ts',
      "import { provideStreamConfig } from '@ethlete/components';\n\nexport const providers = [provideStreamConfig({ layouts: [] })];\n",
    );

    await migrateStreamDefaultComponents(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/app.config.ts', 'utf-8')).toBe(
      "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig } from '@ethlete/components';\n\nexport const providers = [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS, layouts: [] })];\n",
    );
    expect(tree.exists(STREAM_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it('reports the stream slots of an app without any stream config', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/app/stream.component.html', '<et-youtube-player-slot videoId="a" />\n');

    await migrateStreamDefaultComponents(tree, { skipFormat: true });

    const report = tree.read(STREAM_DEFAULT_COMPONENTS_REPORT_PATH, 'utf-8');

    expect(report).toContain('apps/shop/src/app/stream.component.html:1');
    expect(report).toContain('provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })');
  });

  it('adds the default components to the application config of an app without any stream config', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/app/stream.component.html', '<et-youtube-player-slot videoId="a" />\n');
    tree.write(
      'apps/shop/src/app/app.config.ts',
      "import { ApplicationConfig } from '@angular/core';\nimport { provideBracketConfig } from '@ethlete/components';\n\nexport const appConfig: ApplicationConfig = { providers: [provideBracketConfig()] };\n",
    );

    await migrateStreamDefaultComponents(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/app.config.ts', 'utf-8')).toBe(
      "import { ApplicationConfig } from '@angular/core';\nimport { STREAM_DEFAULT_COMPONENTS, provideStreamConfig, provideBracketConfig } from '@ethlete/components';\n\nexport const appConfig: ApplicationConfig = { providers: [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS }), provideBracketConfig()] };\n",
    );
    expect(tree.exists(STREAM_DEFAULT_COMPONENTS_REPORT_PATH)).toBe(false);
  });

  it('adds an import and fills an empty providers array', () => {
    expect(
      addStreamConfigToAppConfig(
        "import { ApplicationConfig } from '@angular/core';\nexport const appConfig: ApplicationConfig = { providers: [ ] };",
      ),
    ).toBe(
      "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig } from '@ethlete/components';\nimport { ApplicationConfig } from '@angular/core';\nexport const appConfig: ApplicationConfig = { providers: [provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })] };",
    );
  });

  it('leaves a merged server config and a file without an application config alone', () => {
    expect(
      addStreamConfigToAppConfig(
        'const serverConfig: ApplicationConfig = { providers: [provideServerRendering()] };\nmergeApplicationConfig(appConfig, serverConfig);',
      ),
    ).toBeNull();
    expect(addStreamConfigToAppConfig('@Component({ providers: [Foo] })')).toBeNull();
  });

  it('adds an overlay component next to STREAM_IMPORTS where a template renders its selector', () => {
    const content = [
      "import { STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '@ethlete/components';",
      "@Component({ imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS], template: '<et-stream-player-loading />' })",
    ].join('\n');

    expect(addStreamOverlayImportsToFile(content, [])).toBe(
      [
        "import { STREAM_IMPORTS, StreamPlayerLoadingComponent, STREAM_YOUTUBE_IMPORTS } from '@ethlete/components';",
        "@Component({ imports: [STREAM_IMPORTS, StreamPlayerLoadingComponent, STREAM_YOUTUBE_IMPORTS], template: '<et-stream-player-loading />' })",
      ].join('\n'),
    );
  });

  it('reads an external template and leaves a component that renders neither overlay alone', () => {
    const content = "import { STREAM_IMPORTS } from '@ethlete/components';\nconst i = [...STREAM_IMPORTS];";

    expect(addStreamOverlayImportsToFile(content, ['<et-stream-player-error />'])).toBe(
      "import { STREAM_IMPORTS, StreamPlayerErrorComponent } from '@ethlete/components';\nconst i = [...STREAM_IMPORTS, StreamPlayerErrorComponent];",
    );
    expect(addStreamOverlayImportsToFile(content, ['<et-youtube-player-slot />'])).toBeNull();
  });
});
