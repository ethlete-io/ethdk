import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import migrateFromCdk, { MIGRATE_FROM_CDK_REPORT_PATH } from './migration';

const normalize = (code: string) =>
  code
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const writeInstalledVersion = (tree: Tree, version: string | null) =>
  tree.write(
    'package.json',
    JSON.stringify({
      name: 'test-workspace',
      dependencies: version ? { '@ethlete/components': version } : {},
    }),
  );

describe('migrate-from-cdk', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeInstalledVersion(tree, '1.0.0-next.40');
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // keep the generator's progress output out of the test report
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const run = () => migrateFromCdk(tree, { skipFormat: true });

  describe('imports', () => {
    it('merges moved symbols into an existing @ethlete/components import', async () => {
      tree.write(
        'src/app/test.component.ts',
        `import { Component } from '@angular/core';
import { ButtonComponent } from '@ethlete/components';
import { OverlayImports, PictureSource } from '@ethlete/cdk';

@Component({
  imports: [ButtonComponent, OverlayImports],
  template: '',
})
export class TestComponent {
  source: PictureSource | null = null;
}`,
      );

      await run();

      expect(normalize(tree.read('src/app/test.component.ts', 'utf-8')!)).toBe(
        normalize(`import { Component } from '@angular/core';
import { ButtonComponent, OVERLAY_IMPORTS, PictureSource } from '@ethlete/components';

@Component({
  imports: [ButtonComponent, OVERLAY_IMPORTS],
  template: '',
})
export class TestComponent {
  source: PictureSource | null = null;
}`),
      );
    });

    it('rewrites the FooImports → FOO_IMPORTS family and its references', async () => {
      tree.write(
        'src/app/skeleton.component.ts',
        `import { Component } from '@angular/core';
import { SkeletonImports } from '@ethlete/cdk';

@Component({
  imports: [SkeletonImports],
  template: '<et-skeleton />',
})
export class SkeletonHostComponent {}`,
      );

      await run();

      const content = tree.read('src/app/skeleton.component.ts', 'utf-8')!;

      expect(content).toContain(`import { SKELETON_IMPORTS } from '@ethlete/components';`);
      expect(content).toContain('imports: [SKELETON_IMPORTS]');
      expect(content).not.toContain('@ethlete/cdk');
    });

    it('keeps the cdk import for symbols that have no mechanical successor', async () => {
      tree.write(
        'src/app/form.ts',
        `import { InputDirective, injectRouterNavigationState } from '@ethlete/cdk';

export const state = injectRouterNavigationState;
export type Control = InputDirective;`,
      );

      await run();

      const content = tree.read('src/app/form.ts', 'utf-8')!;

      expect(content).toContain(`import { InputDirective } from '@ethlete/cdk';`);
      expect(content).toContain(`import { injectRouterNavigationState } from '@ethlete/core';`);
    });

    it('reuses an existing aliased import instead of duplicating the specifier', async () => {
      tree.write(
        'src/app/app.config.ts',
        `import { provideOverlay } from '@ethlete/cdk';
import { provideOverlay as provideComponentsOverlay } from '@ethlete/components';

export const providers = [provideOverlay(), provideComponentsOverlay()];`,
      );

      await run();

      const content = tree.read('src/app/app.config.ts', 'utf-8')!;

      expect(content).toContain(`import { provideOverlay as provideComponentsOverlay } from '@ethlete/components';`);
      expect(content).not.toContain('@ethlete/cdk');
      expect(content).toContain('export const providers = [provideComponentsOverlay(), provideComponentsOverlay()];');
    });
  });

  describe('templates', () => {
    it('adds shape="rect" to skeleton items that have no shape', async () => {
      tree.write(
        'src/app/skeleton.component.html',
        `<et-skeleton>
  <et-skeleton-item></et-skeleton-item>
  <et-skeleton-item shape="circle"></et-skeleton-item>
  <et-skeleton-item [shape]="shape()"></et-skeleton-item>
</et-skeleton>`,
      );

      await run();

      expect(tree.read('src/app/skeleton.component.html', 'utf-8')).toBe(
        `<et-skeleton>
  <et-skeleton-item shape="rect"></et-skeleton-item>
  <et-skeleton-item shape="circle"></et-skeleton-item>
  <et-skeleton-item [shape]="shape()"></et-skeleton-item>
</et-skeleton>`,
      );
    });

    it('migrates the spinner tag, its inputs and its colour variable', async () => {
      tree.write(
        'src/app/spinner.component.html',
        `<et-progress-spinner mode="indeterminate" renderBackground multiColor></et-progress-spinner>
<et-progress-spinner mode="determinate" [value]="progress()"></et-progress-spinner>`,
      );
      tree.write('src/app/spinner.component.css', '.loader { --et-progress-spinner-color: red; }');

      await run();

      expect(tree.read('src/app/spinner.component.html', 'utf-8')).toBe(
        `<et-spinner track></et-spinner>
<et-spinner [determinate]="true" [value]="progress()"></et-spinner>`,
      );
      expect(tree.read('src/app/spinner.component.css', 'utf-8')).toBe('.loader { --et-spinner-color: red; }');
    });

    it('renames picture and tooltip attributes, inline templates included', async () => {
      tree.write(
        'src/app/hero.component.ts',
        `import { Component } from '@angular/core';

@Component({
  template: '<et-picture hasPriority (imgLoaded)="onLoad()" alt="" /><b tooltipAriaDescription="x"></b>',
})
export class HeroComponent {}`,
      );

      await run();

      const content = tree.read('src/app/hero.component.ts', 'utf-8')!;

      expect(content).toContain('<et-picture priority (imgLoad)="onLoad()" alt="" />');
      expect(content).toContain('<b etTooltipAriaDescription="x"></b>');
    });

    it('leaves <et-picture> attributes alone while its import still points at cdk', async () => {
      tree.write(
        'src/app/hero.component.ts',
        `import { Component } from '@angular/core';
import { PictureComponent } from '@ethlete/cdk';

@Component({
  imports: [PictureComponent],
  template: '<et-picture hasPriority (imgLoaded)="onLoad()" alt="" />',
})
export class HeroComponent {}`,
      );

      await run();

      const content = tree.read('src/app/hero.component.ts', 'utf-8')!;

      expect(content).toContain('<et-picture hasPriority (imgLoaded)="onLoad()" alt="" />');
      expect(content).toContain(`import { PictureComponent } from '@ethlete/cdk';`);
    });

    it('gates an external template’s <et-picture> rewrite on its component’s own PictureComponent import', async () => {
      tree.write(
        'src/app/gallery.component.ts',
        `import { Component } from '@angular/core';
import { PictureComponent } from '@ethlete/cdk';

@Component({
  imports: [PictureComponent],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {}`,
      );
      tree.write('src/app/gallery.component.html', '<et-picture hasPriority (imgLoaded)="onLoad()" alt="" />');

      await run();

      expect(tree.read('src/app/gallery.component.html', 'utf-8')).toBe(
        '<et-picture hasPriority (imgLoaded)="onLoad()" alt="" />',
      );
    });
  });

  describe('version gating', () => {
    it('skips a since-gated row and reports it instead', async () => {
      writeInstalledVersion(tree, '^1.0.0-next.30');
      tree.write(
        'src/app/radio.ts',
        `import { RadioImports } from '@ethlete/cdk';\n\nexport const imports = RadioImports;`,
      );

      await run();

      expect(tree.read('src/app/radio.ts', 'utf-8')).toContain(`import { RadioImports } from '@ethlete/cdk';`);

      const report = tree.read(MIGRATE_FROM_CDK_REPORT_PATH, 'utf-8')!;

      expect(report).toContain('`RadioImports`');
      expect(report).toContain('`RADIO_GROUP_IMPORTS` requires `@ethlete/components` ≥ 1.0.0-next.34');
    });

    it('rewrites the same row once the installed version satisfies it', async () => {
      writeInstalledVersion(tree, '1.0.0-next.34');
      tree.write(
        'src/app/radio.ts',
        `import { RadioImports } from '@ethlete/cdk';\n\nexport const imports = RadioImports;`,
      );

      await run();

      const content = tree.read('src/app/radio.ts', 'utf-8')!;

      expect(content).toContain(`import { RADIO_GROUP_IMPORTS } from '@ethlete/components';`);
      expect(content).toContain('export const imports = RADIO_GROUP_IMPORTS;');
    });
  });

  describe('report', () => {
    it('classifies picture class inputs by sizing mode and finds missing alt text', async () => {
      tree.write(
        'src/app/gallery.component.html',
        `<et-picture imgClass="h-10 w-10 object-cover" alt="Badge" />
<et-picture imgClass="max-h-41 w-auto" alt="Logo" />
<et-picture [imgClass]="pictureClasses()" alt="Dynamic" />
<et-picture figureClass="mb-4" alt="Wrapped" />
<et-picture defaultSrc="/hero.jpg" />`,
      );

      await run();

      const report = tree.read(MIGRATE_FROM_CDK_REPORT_PATH, 'utf-8')!;

      expect(report).toContain('### Definite in both axes - use `fit`');
      expect(report).toContain('`src/app/gallery.component.html:1` - `imgClass`="h-10 w-10 object-cover"');
      expect(report).toContain('### Image sizes its own box - style `.et-picture-img`');
      expect(report).toContain('`src/app/gallery.component.html:2` - `imgClass`="max-h-41 w-auto"');
      expect(report).toContain('### Unclassified - decide per site');
      expect(report).toContain('`src/app/gallery.component.html:3` - `imgClass` (bound expression)');
      expect(report).toContain('### Wrapper classes');
      expect(report).toContain('## `<et-picture>` without `alt`');
      expect(report).toContain('`src/app/gallery.component.html:5`');
      expect(report).not.toContain('`src/app/gallery.component.html:4` - `imgClass`');
    });

    it('lists symbols whose contract changed with their docs link and note', async () => {
      tree.write('src/app/form.ts', `import { InputDirective, PictureComponent } from '@ethlete/cdk';`);

      await run();

      const report = tree.read(MIGRATE_FROM_CDK_REPORT_PATH, 'utf-8')!;

      expect(report).toContain('## Symbols whose contract changed');
      expect(report).toContain('replaced-by: becomes `FormFieldControl` in `@ethlete/components`');
      expect(report).toContain('reshape: stays `PictureComponent` in `@ethlete/components`');
      expect(report).toContain('https://ethlete-sdk-docs.web.app/components/picture');
    });

    it('flags TableImports and TabImports as needing a manual decision instead of renaming them', async () => {
      tree.write(
        'src/app/table.ts',
        `import { TableImports, TabImports } from '@ethlete/cdk';

export const imports = [TableImports, TabImports];`,
      );

      await run();

      const content = tree.read('src/app/table.ts', 'utf-8')!;

      expect(content).toContain(`import { TableImports, TabImports } from '@ethlete/cdk';`);

      const report = tree.read(MIGRATE_FROM_CDK_REPORT_PATH, 'utf-8')!;

      expect(report).toContain('### `TableImports`');
      expect(report).toContain('### `TabImports`');
      expect(report).toContain('rename+reshape: becomes `TABLE_IMPORTS` in `@ethlete/components`');
      expect(report).toContain('rename+reshape: becomes `TAB_IMPORTS` in `@ethlete/components`');
    });

    it('flags themed spinner styling', async () => {
      tree.write(
        'src/styles.css',
        `.page-loader {\n  --et-progress-spinner-color: #1e88e5;\n}\n\n.et-legacy .brand {\n  color: #1e88e5;\n}`,
      );

      await run();

      const report = tree.read(MIGRATE_FROM_CDK_REPORT_PATH, 'utf-8')!;

      expect(report).toContain('## Themed spinners');
      expect(report).toContain('`src/styles.css:2`');
      expect(report).toContain('`src/styles.css:5`');
      expect(report).toContain('`color` input');
    });

    it('writes no report when nothing needs a decision', async () => {
      tree.write('src/app/skeleton.component.html', '<et-skeleton-item></et-skeleton-item>');

      await run();

      expect(tree.exists(MIGRATE_FROM_CDK_REPORT_PATH)).toBe(false);
    });
  });
});
