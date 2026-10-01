import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callErrorColorTheme, collectErrorColorThemeReceivers } from './error-color-theme-signal';
import migrateErrorColorThemeSignal from './migration';

const migrate = (content: string) => callErrorColorTheme(content, collectErrorColorThemeReceivers(content));

describe('migrate-error-color-theme-signal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls errorColorTheme on an injectFormSupport() result and a TableComponent in TypeScript', () => {
    expect(
      migrate(
        [
          "import { injectFormSupport, TableComponent } from '@ethlete/components';",
          'export class C {',
          '  private support = injectFormSupport();',
          '  private table = viewChild.required(TableComponent);',
          '  theme = this.support.errorColorTheme;',
          '  tableTheme = computed(() => this.table().errorColorTheme);',
          '  direct = injectFormSupport().errorColorTheme;',
          '}',
          'export const of = (grid: TableComponent<Row> | undefined) => grid?.errorColorTheme;',
        ].join('\n'),
      ),
    ).toBe(
      [
        "import { injectFormSupport, TableComponent } from '@ethlete/components';",
        'export class C {',
        '  private support = injectFormSupport();',
        '  private table = viewChild.required(TableComponent);',
        '  theme = this.support.errorColorTheme();',
        '  tableTheme = computed(() => this.table().errorColorTheme());',
        '  direct = injectFormSupport().errorColorTheme();',
        '}',
        'export const of = (grid: TableComponent<Row> | undefined) => grid?.errorColorTheme();',
      ].join('\n'),
    );
  });

  it('leaves a read that is already a call alone', () => {
    expect(
      migrate(
        [
          'const support = injectFormSupport();',
          'const theme = support.errorColorTheme();',
          'const spaced = support.errorColorTheme ();',
        ].join('\n'),
      ),
    ).toBeNull();
  });

  it('leaves errorColorTheme on an unrelated receiver alone', () => {
    expect(
      migrate(
        [
          "import { TableComponent } from '@ethlete/components';",
          'const table = inject(TableComponent);',
          'const theme = this.palette.errorColorTheme;',
          'const other = settings.errorColorTheme;',
          'const ownTable = this.table.errorColorThemeName;',
        ].join('\n'),
      ),
    ).toBeNull();
  });

  it('rewrites a component template through its class and an et-table template ref', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'apps/shop/src/app/field.component.ts',
      [
        "import { injectFormSupport } from '@ethlete/components';",
        "@Component({ selector: 'app-field', templateUrl: './field.component.html' })",
        'export class FieldComponent { protected support = injectFormSupport(); }',
        '',
      ].join('\n'),
    );
    tree.write(
      'apps/shop/src/app/field.component.html',
      [
        '<span [etProvideColor]="support.errorColorTheme"></span>',
        '<et-table #grid [data]="rows" />',
        '<i [etProvideColor]="grid.errorColorTheme"></i>',
        '<b [etProvideColor]="theme.errorColorTheme"></b>',
        '',
      ].join('\n'),
    );
    tree.write('apps/shop/src/app/unrelated.html', '<b [etProvideColor]="support.errorColorTheme"></b>\n');

    await migrateErrorColorThemeSignal(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/field.component.html', 'utf-8')).toBe(
      [
        '<span [etProvideColor]="support.errorColorTheme()"></span>',
        '<et-table #grid [data]="rows" />',
        '<i [etProvideColor]="grid.errorColorTheme()"></i>',
        '<b [etProvideColor]="theme.errorColorTheme"></b>',
        '',
      ].join('\n'),
    );
    expect(tree.read('apps/shop/src/app/unrelated.html', 'utf-8')).toBe(
      '<b [etProvideColor]="support.errorColorTheme"></b>\n',
    );
  });
});
