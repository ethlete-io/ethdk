import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import migrateSelectInputRenames from './migration';
import { renameSelectInputs } from './select-input-renames';

describe('migrate-select-input-renames', () => {
  it('renames property, plain and bind- forms of error on et-select', () => {
    expect(
      renameSelectInputs(
        [
          '<et-select [error]="users.error()" [errors]="errors">',
          '<et-select\n  error="Failed"\n  multiple\n/>',
          '<et-select bind-error="message" />',
        ].join('\n'),
      ),
    ).toBe(
      [
        '<et-select [loadError]="users.error()" [errors]="errors">',
        '<et-select\n  loadError="Failed"\n  multiple\n/>',
        '<et-select bind-loadError="message" />',
      ].join('\n'),
    );
  });

  it('renames error on an etSelect host element', () => {
    expect(renameSelectInputs('<div etSelect [error]="message"></div>')).toBe(
      '<div etSelect [loadError]="message"></div>',
    );
  });

  it('leaves error on other elements alone', () => {
    expect(
      renameSelectInputs(
        '<et-table [error]="error()" /><et-select-option [error]="x" /><et-form-error [error]="error" />',
      ),
    ).toBeNull();
  });

  it('keeps attribute values containing a closing bracket intact', () => {
    expect(renameSelectInputs('<et-select [loading]="a > b" [error]="c > d">')).toBe(
      '<et-select [loading]="a > b" [loadError]="c > d">',
    );
  });

  it('rewrites the component and its templateUrl file, only where @ethlete/components is imported', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'apps/shop/src/app/picker.component.ts',
      [
        "import { SELECT_IMPORTS } from '@ethlete/components';",
        "@Component({ templateUrl: './picker.component.html' })",
        'export class PickerComponent {}',
        '',
      ].join('\n'),
    );
    tree.write('apps/shop/src/app/picker.component.html', '<et-select [error]="error()" />\n');
    tree.write(
      'apps/shop/src/app/inline.component.ts',
      [
        "import { SelectComponent } from '@ethlete/components';",
        '@Component({ template: `<et-select [error]="error()" />` })',
        'export class InlineComponent {}',
        '',
      ].join('\n'),
    );
    tree.write('apps/shop/src/app/other.ts', 'const t = `<et-select [error]="x" />`;\n');

    await migrateSelectInputRenames(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/picker.component.html', 'utf-8')).toBe('<et-select [loadError]="error()" />\n');
    expect(tree.read('apps/shop/src/app/inline.component.ts', 'utf-8')).toContain(
      '<et-select [loadError]="error()" />',
    );
    expect(tree.read('apps/shop/src/app/other.ts', 'utf-8')).toBe('const t = `<et-select [error]="x" />`;\n');
  });
});
