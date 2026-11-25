import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import migrateTabsActiveUnderline from './migration';
import { removeActiveUnderline } from './tabs-active-underline';

const appConfig = (config: string) =>
  [
    "import { ApplicationConfig } from '@angular/core';",
    "import { provideTabsConfig } from '@ethlete/components';",
    '',
    'export const appConfig: ApplicationConfig = {',
    `  providers: [${config}],`,
    '};',
    '',
  ].join('\n');

describe('migrate-tabs-active-underline', () => {
  it('drops the option in front of another option', () => {
    expect(
      removeActiveUnderline(appConfig("provideTabsConfig({ activeUnderline: false, underlineWidth: 'label' })")),
    ).toBe(appConfig("provideTabsConfig({ underlineWidth: 'label' })"));
  });

  it('drops the option behind another option', () => {
    expect(
      removeActiveUnderline(appConfig("provideTabsConfig({ underlineWidth: 'label', activeUnderline: true })")),
    ).toBe(appConfig("provideTabsConfig({ underlineWidth: 'label' })"));
  });

  it('leaves an empty object when it was the only option', () => {
    expect(removeActiveUnderline(appConfig('provideTabsConfig({ activeUnderline: false })'))).toBe(
      appConfig('provideTabsConfig({})'),
    );
  });

  it('drops a multi-line property with its line', () => {
    const source = appConfig("provideTabsConfig({\n    activeUnderline: false,\n    underlineWidth: 'label',\n  })");

    expect(removeActiveUnderline(source)).toBe(appConfig("provideTabsConfig({\n    underlineWidth: 'label',\n  })"));
  });

  it('leaves other calls and the activeUnderline input alone', () => {
    expect(
      removeActiveUnderline('other({ activeUnderline: false }); <et-tab-group [activeUnderline]="false">'),
    ).toBeNull();
  });

  it('rewrites only files that import @ethlete/components', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const source = appConfig("provideTabsConfig({ activeUnderline: false, underlineWidth: 'label' })");

    tree.write('apps/shop/src/app/app.config.ts', source);
    tree.write('apps/shop/src/app/other.ts', source.replace('@ethlete/components', 'other-lib'));

    await migrateTabsActiveUnderline(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/app.config.ts', 'utf-8')).toBe(
      appConfig("provideTabsConfig({ underlineWidth: 'label' })"),
    );
    expect(tree.read('apps/shop/src/app/other.ts', 'utf-8')).toContain('activeUnderline: false');
  });
});
