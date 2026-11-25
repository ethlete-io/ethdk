import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import migratePipWindowZIndex, { PIP_WINDOW_Z_INDEX_REPORT_PATH } from './migration';
import { addPipWindowConfigToAppConfig, scanPipWindowZIndexInFile } from './pip-window-z-index';

const APP_CONFIG = 'apps/shop/src/app/app.config.ts';
const STYLES = 'apps/shop/src/styles.css';

const appConfig = [
  "import { ApplicationConfig } from '@angular/core';",
  "import { provideStreamPip } from '@ethlete/components';",
  '',
  'export const appConfig: ApplicationConfig = {',
  '  providers: [...provideStreamPip()],',
  '};',
  '',
].join('\n');

const createTree = (files: Record<string, string>) => {
  const tree = createTreeWithEmptyWorkspace();

  for (const [path, content] of Object.entries(files)) tree.write(path, content);

  return tree;
};

describe('migrate-pip-window-z-index', () => {
  it('drops a literal declaration from a stylesheet and keeps its value', () => {
    const { next, values, tasks } = scanPipWindowZIndexInFile(
      STYLES,
      ':root {\n  --et-pip-window-z-index: 2147483100;\n  --et-pip-window-offset-right: 16px;\n}\n',
    );

    expect(next).toBe(':root {\n  --et-pip-window-offset-right: 16px;\n}\n');
    expect(values).toEqual([2147483100]);
    expect(tasks).toEqual([]);
  });

  it('reports a declaration it cannot move, and one in a template', () => {
    const scss = scanPipWindowZIndexInFile('apps/shop/src/styles.scss', ':root {\n  --et-pip-window-z-index: $pip;\n}');
    const html = scanPipWindowZIndexInFile(
      'apps/shop/src/app/app.html',
      '<div style="--et-pip-window-z-index: 5"></div>',
    );

    expect(scss.next).toBeNull();
    expect(scss.tasks).toEqual([expect.objectContaining({ file: 'apps/shop/src/styles.scss', line: 2 })]);
    expect(html.next).toBeNull();
    expect(html.tasks).toEqual([expect.objectContaining({ file: 'apps/shop/src/app/app.html', line: 1 })]);
  });

  it('adds the provider to an application config and imports it', () => {
    expect(addPipWindowConfigToAppConfig(appConfig, 2147483100)).toBe(
      [
        "import { ApplicationConfig } from '@angular/core';",
        "import { providePipWindowConfig, provideStreamPip } from '@ethlete/components';",
        '',
        'export const appConfig: ApplicationConfig = {',
        '  providers: [...providePipWindowConfig({ overlayLayer: 2147483100 }), ...provideStreamPip()],',
        '};',
        '',
      ].join('\n'),
    );
    expect(addPipWindowConfigToAppConfig('export const providers = [];', 1)).toBeNull();
  });

  it('moves one literal value into the application config', async () => {
    const tree = createTree({
      [APP_CONFIG]: appConfig,
      [STYLES]: ':root {\n  --et-pip-window-z-index: 2147483100;\n}\n',
    });

    await migratePipWindowZIndex(tree, { skipFormat: true });

    expect(tree.read(STYLES, 'utf-8')).not.toContain('--et-pip-window-z-index');
    expect(tree.read(APP_CONFIG, 'utf-8')).toContain('...providePipWindowConfig({ overlayLayer: 2147483100 })');
    expect(tree.exists(PIP_WINDOW_Z_INDEX_REPORT_PATH)).toBe(false);
  });

  it('leaves differing values in place and names each file in the report', async () => {
    const tree = createTree({
      [APP_CONFIG]: appConfig,
      [STYLES]: ':root {\n  --et-pip-window-z-index: 2147483100;\n}\n',
      'apps/shop/src/app/match.css': '.match {\n  --et-pip-window-z-index: 900;\n}\n',
    });

    await migratePipWindowZIndex(tree, { skipFormat: true });

    const report = tree.read(PIP_WINDOW_Z_INDEX_REPORT_PATH, 'utf-8') ?? '';

    expect(tree.read(STYLES, 'utf-8')).toContain('--et-pip-window-z-index: 2147483100');
    expect(tree.read(APP_CONFIG, 'utf-8')).toBe(appConfig);
    expect(report).toContain(`${STYLES}:2`);
    expect(report).toContain('apps/shop/src/app/match.css:2');
  });

  it('keeps the value when no application config can take the provider', async () => {
    const tree = createTree({ [STYLES]: ':root {\n  --et-pip-window-z-index: 2147483100;\n}\n' });

    await migratePipWindowZIndex(tree, { skipFormat: true });

    expect(tree.read(STYLES, 'utf-8')).toContain('--et-pip-window-z-index: 2147483100');
    expect(tree.read(PIP_WINDOW_Z_INDEX_REPORT_PATH, 'utf-8')).toContain(`${STYLES}:2`);
  });

  it('does nothing in a workspace that never set it', async () => {
    const tree = createTree({ [APP_CONFIG]: appConfig });

    await migratePipWindowZIndex(tree, { skipFormat: true });

    expect(tree.read(APP_CONFIG, 'utf-8')).toBe(appConfig);
    expect(tree.exists(PIP_WINDOW_Z_INDEX_REPORT_PATH)).toBe(false);
  });
});
