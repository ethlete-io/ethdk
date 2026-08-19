import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migration, { CONTENTFUL_V5_REPORT_PATH } from './migration';

describe('migrate-to-contentful-v5', () => {
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

  it('renames hasPriority to priority in html templates', async () => {
    tree.write(
      'apps/web/src/app/page.component.html',
      [
        '<et-contentful-image [asset]="asset" [hasPriority]="true" />',
        '<et-contentful-image [asset]="other" hasPriority />',
        '<et-contentful-image [asset]="third" hasPriority="true" />',
        '<img [hasPriority]="true" />',
      ].join('\n'),
    );

    await migration(tree, { skipFormat: true });

    const result = tree.read('apps/web/src/app/page.component.html', 'utf-8');

    expect(result).toContain('<et-contentful-image [asset]="asset" [priority]="true" />');
    expect(result).toContain('<et-contentful-image [asset]="other" priority />');
    expect(result).toContain('<et-contentful-image [asset]="third" priority="true" />');
    expect(result).toContain('<img [hasPriority]="true" />');
  });

  it('renames hasPriority inside an inline template', async () => {
    tree.write(
      'apps/web/src/app/inline.component.ts',
      [
        "import { Component } from '@angular/core';",
        '',
        '@Component({',
        "  selector: 'app-inline',",
        '  template: `',
        '    <et-contentful-image [asset]="asset" [hasPriority]="true" />',
        '  `,',
        '})',
        'export class InlineComponent {}',
      ].join('\n'),
    );

    await migration(tree, { skipFormat: true });

    const result = tree.read('apps/web/src/app/inline.component.ts', 'utf-8');

    expect(result).toContain('[priority]="true"');
    expect(result).not.toContain('hasPriority');
  });

  it('removes the useTailwindClasses config option', async () => {
    tree.write(
      'apps/web/src/app/app.config.ts',
      [
        'export const config = provideContentfulConfig({',
        '  useTailwindClasses: true,',
        '  internalHosts: [],',
        '});',
      ].join('\n'),
    );

    await migration(tree, { skipFormat: true });

    const result = tree.read('apps/web/src/app/app.config.ts', 'utf-8');

    expect(result).not.toContain('useTailwindClasses');
    expect(result).toContain('internalHosts: [],');
  });

  it('removes useTailwindClasses from a single-line config object', async () => {
    tree.write(
      'apps/web/src/app/app.config.ts',
      'export const config = provideContentfulConfig({ useTailwindClasses: true, internalHosts: [] });',
    );

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/app/app.config.ts', 'utf-8')).toBe(
      'export const config = provideContentfulConfig({ internalHosts: [] });',
    );
  });

  it('reports removed class inputs without touching them', async () => {
    tree.write(
      'apps/web/src/app/classes.component.html',
      '<et-contentful-image [asset]="asset" [imgClass]="\'a\'" figureClass="b" />',
    );

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/app/classes.component.html', 'utf-8')).toContain('[imgClass]');

    const report = tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8');

    expect(report).toContain('image-class-input:apps/web/src/app/classes.component.html:1');
    expect(report).toContain('`imgClass`, `figureClass`');
    expect(report).toContain('et-picture-*');
  });

  it('reports removed renderer exports', async () => {
    tree.write(
      'apps/web/src/app/renderer.ts',
      "import { isTextRenderCommand, RENDER_COMMAND_TYPE, ContentfulImageComponent } from '@ethlete/contentful';",
    );

    await migration(tree, { skipFormat: true });

    const report = tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8');

    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:isTextRenderCommand');
    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:RENDER_COMMAND_TYPE');
    expect(report).not.toContain('ContentfulImageComponent');
  });

  it('reports removed exports in re-exports and default plus named imports', async () => {
    tree.write(
      'apps/web/src/app/renderer.ts',
      [
        "export { RENDER_COMMAND_TYPE } from '@ethlete/contentful';",
        "import contentful, { isTextRenderCommand } from '@ethlete/contentful';",
      ].join('\n'),
    );

    await migration(tree, { skipFormat: true });

    const report = tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8');

    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:RENDER_COMMAND_TYPE');
    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:isTextRenderCommand');
  });

  it('reports namespace imports and star re-exports for manual review', async () => {
    tree.write(
      'apps/web/src/app/renderer.ts',
      ["import * as contentful from '@ethlete/contentful';", "export * from '@ethlete/contentful';"].join('\n'),
    );

    await migration(tree, { skipFormat: true });

    const report = tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8');

    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:contentful');
    expect(report).toContain('removed-export:apps/web/src/app/renderer.ts:*');
  });

  it('renames inputs after a greater-than sign inside an image attribute', async () => {
    tree.write(
      'apps/web/src/app/page.component.html',
      '<et-contentful-image [sizes]="width > 5 ? large : small" [hasPriority]="true" />',
    );

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/app/page.component.html', 'utf-8')).toContain('[priority]="true"');
  });

  it('adds @ethlete/components next to @ethlete/contentful and flags a leftover cdk dependency', async () => {
    tree.write(
      'apps/web/package.json',
      JSON.stringify({
        name: 'web',
        dependencies: { '@ethlete/contentful': '^4.0.0', '@ethlete/cdk': '^5.0.0' },
      }),
    );

    const install = await migration(tree, { skipFormat: true });

    const packageJson = JSON.parse(tree.read('apps/web/package.json', 'utf-8') ?? '{}');

    expect(packageJson.dependencies['@ethlete/components']).toBe('^1.0.0-next.32');
    expect(packageJson.dependencies['@ethlete/cdk']).toBe('^5.0.0');

    expect(tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8')).toContain('cdk-dependency:apps/web/package.json');
    expect(install).toBeTypeOf('function');
  });

  it('does not rewrite an unrelated package json', async () => {
    const packageJson = '{\n    // Keep this JSONC comment.\n    "name": "unrelated",\n    "private": true\n}\n';
    tree.write('apps/unrelated/package.json', packageJson);

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/unrelated/package.json', 'utf-8')).toBe(packageJson);
    expect(tree.listChanges().filter((change) => change.path === 'apps/unrelated/package.json')).toHaveLength(1);
  });

  it('leaves @ethlete/components alone when it is already declared as a peer dependency', async () => {
    tree.write(
      'apps/web/package.json',
      JSON.stringify({
        name: 'web',
        dependencies: { '@ethlete/contentful': '^4.0.0' },
        peerDependencies: { '@ethlete/components': '^1.0.0-next.10' },
      }),
    );

    await migration(tree, { skipFormat: true });

    const packageJson = JSON.parse(tree.read('apps/web/package.json', 'utf-8') ?? '{}');

    expect(packageJson.dependencies['@ethlete/components']).toBeUndefined();
    expect(packageJson.peerDependencies['@ethlete/components']).toBe('^1.0.0-next.10');
  });

  it('does not touch files outside the scoped projects', async () => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', sourceRoot: 'apps/web/src' });

    const template = '<et-contentful-image [asset]="asset" [hasPriority]="true" />';

    tree.write('apps/web/src/in-scope.html', template);
    tree.write('apps/other/src/out-of-scope.html', template);

    await migration(tree, { projects: ['web'], skipFormat: true });

    expect(tree.read('apps/web/src/in-scope.html', 'utf-8')).toContain('[priority]=');
    expect(tree.read('apps/other/src/out-of-scope.html', 'utf-8')).toBe(template);
  });

  it('visits files once when projects and include scopes overlap', async () => {
    addProjectConfiguration(tree, 'web', { root: 'apps/web', sourceRoot: 'apps/web/src' });
    tree.write('apps/web/src/classes.component.html', '<et-contentful-image [asset]="asset" [imgClass]="classes" />');

    await migration(tree, { projects: ['web'], include: ['apps/web/src'], skipFormat: true });

    const report = tree.read(CONTENTFUL_V5_REPORT_PATH, 'utf-8') ?? '';
    const taskId = 'image-class-input:apps/web/src/classes.component.html:1';

    expect(report.split(taskId)).toHaveLength(2);
  });
});
