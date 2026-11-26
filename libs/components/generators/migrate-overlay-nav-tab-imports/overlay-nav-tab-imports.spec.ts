import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import migrateOverlayNavTabImports from './migration';
import { addOverlayNavTabImportsToFile } from './overlay-nav-tab-imports';

const inlineComponent = [
  "import { Component } from '@angular/core';",
  "import { BUTTON_IMPORTS, NAV_TAB_IMPORTS } from '@ethlete/components';",
  '',
  '@Component({',
  '  imports: [BUTTON_IMPORTS, NAV_TAB_IMPORTS],',
  '  template: `<et-nav-tabs><button et-overlay-nav-tab-link="/">General</button></et-nav-tabs>`,',
  '})',
  'export class SettingsOverlayComponent {}',
].join('\n');

describe('migrate-overlay-nav-tab-imports', () => {
  it('adds OVERLAY_NAV_TAB_IMPORTS to the import and the component imports', () => {
    expect(addOverlayNavTabImportsToFile(inlineComponent, [])).toBe(
      inlineComponent
        .replace(
          'import { BUTTON_IMPORTS, NAV_TAB_IMPORTS }',
          'import { BUTTON_IMPORTS, NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS }',
        )
        .replace(
          'imports: [BUTTON_IMPORTS, NAV_TAB_IMPORTS]',
          'imports: [BUTTON_IMPORTS, NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS]',
        ),
    );
  });

  it('spreads it next to a spread NAV_TAB_IMPORTS', () => {
    const content = [
      "import { NAV_TAB_IMPORTS } from '@ethlete/components';",
      'const SHARED = [...NAV_TAB_IMPORTS];',
      'const template = `<button et-overlay-nav-tab-link="/">A</button>`;',
    ].join('\n');

    expect(addOverlayNavTabImportsToFile(content, [])).toContain(
      'const SHARED = [...NAV_TAB_IMPORTS, ...OVERLAY_NAV_TAB_IMPORTS];',
    );
  });

  it('reads the overlay link from an external template', () => {
    const content = [
      "import { NAV_TAB_IMPORTS } from '@ethlete/components';",
      "@Component({ imports: [NAV_TAB_IMPORTS], templateUrl: './settings.html' })",
      'export class SettingsComponent {}',
    ].join('\n');

    expect(addOverlayNavTabImportsToFile(content, ['<button et-overlay-nav-tab-link="/">A</button>'])).toContain(
      'imports: [NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS]',
    );
  });

  it('leaves router-only nav tabs alone', () => {
    expect(
      addOverlayNavTabImportsToFile(
        inlineComponent.replace('<button et-overlay-nav-tab-link="/">General</button>', '<a et-nav-tab-link="/">A</a>'),
        [],
      ),
    ).toBeNull();
  });

  it('leaves a file alone that already imports OVERLAY_NAV_TAB_IMPORTS', () => {
    const migrated = addOverlayNavTabImportsToFile(inlineComponent, []);

    expect(migrated).not.toBeNull();
    expect(addOverlayNavTabImportsToFile(migrated ?? '', [])).toBeNull();
  });

  it('leaves a NAV_TAB_IMPORTS that is not from @ethlete/components alone', () => {
    expect(
      addOverlayNavTabImportsToFile(inlineComponent.replace("'@ethlete/components'", "'./local-tabs'"), []),
    ).toBeNull();
  });

  it('rewrites the component next to its template in the tree', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'apps/shop/src/app/settings/settings.component.ts',
      [
        "import { Component } from '@angular/core';",
        "import { NAV_TAB_IMPORTS } from '@ethlete/components';",
        '',
        "@Component({ imports: [NAV_TAB_IMPORTS], templateUrl: './settings.component.html' })",
        'export class SettingsComponent {}',
        '',
      ].join('\n'),
    );
    tree.write(
      'apps/shop/src/app/settings/settings.component.html',
      '<et-nav-tabs><button et-overlay-nav-tab-link="/">General</button></et-nav-tabs>\n',
    );

    await migrateOverlayNavTabImports(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/settings/settings.component.ts', 'utf-8')).toBe(
      [
        "import { Component } from '@angular/core';",
        "import { NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS } from '@ethlete/components';",
        '',
        "@Component({ imports: [NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS], templateUrl: './settings.component.html' })",
        'export class SettingsComponent {}',
        '',
      ].join('\n'),
    );
  });
});
