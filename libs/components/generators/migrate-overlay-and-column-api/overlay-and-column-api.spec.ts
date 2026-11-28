import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it, vi } from 'vitest';
import migrateOverlayAndColumnApi from './migration';
import { migrateOverlayAndColumnApiInFile } from './overlay-and-column-api';

const file = (...lines: string[]) =>
  ["import { createOverlayOpener, TableColumnVisibilityHost } from '@ethlete/components';", '', ...lines, ''].join(
    '\n',
  );

const migrate = (...lines: string[]) => migrateOverlayAndColumnApiInFile(file(...lines));

describe('migrate-overlay-and-column-api', () => {
  describe('overlay callbacks', () => {
    it('rewrites the parameter type and null checks of an inline afterClosed', () => {
      const result = migrate(
        'const opener = createOverlayOpener(DEF, {',
        '  afterClosed: (didSave: boolean | null) => {',
        '    if (didSave === null) return;',
        '    if (null !== didSave) save();',
        '  },',
        '});',
      );

      expect(result.content).toBe(
        file(
          'const opener = createOverlayOpener(DEF, {',
          '  afterClosed: (didSave: boolean | undefined) => {',
          '    if (didSave === undefined) return;',
          '    if (undefined !== didSave) save();',
          '  },',
          '});',
        ),
      );
      expect(result.findings).toEqual([]);
    });

    it('rewrites beforeClosed passed to open(), method shorthand and function expressions', () => {
      const result = migrate(
        'this.opener.open({',
        '  beforeClosed(result: Item | null) { return result !== null; },',
        '  afterClosed: function (result: null | Item): void { log(result === null); },',
        '});',
      );

      expect(result.content).toBe(
        file(
          'this.opener.open({',
          '  beforeClosed(result: Item | undefined) { return result !== undefined; },',
          '  afterClosed: function (result: undefined | Item): void { log(result === undefined); },',
          '});',
        ),
      );
    });

    it('drops null when the type already has undefined, and rewrites an untyped expression body', () => {
      expect(
        migrate(
          'createOverlayOpener(DEF, { afterClosed: (r: string | null | undefined) => r, beforeClosed: r => r === null });',
        ).content,
      ).toBe(
        file(
          'createOverlayOpener(DEF, { afterClosed: (r: string | undefined) => r, beforeClosed: r => r === undefined });',
        ),
      );
    });

    it('leaves nested nulls, other variables and strings alone', () => {
      const source = file(
        'createOverlayOpener(DEF, {',
        '  afterClosed: (rows: Array<Row | null>) => {',
        "    const label = 'x === null';",
        '    return other === null;',
        '  },',
        '});',
      );

      expect(migrateOverlayAndColumnApiInFile(source)).toEqual({ content: source, changed: false, findings: [] });
    });

    it('stays quiet about a use that a check narrows first', () => {
      const result = migrate(
        'createOverlayOpener(DEF, {',
        '  afterClosed(choice: string | null) { if (choice !== null) console.log(choice); },',
        '  beforeClosed: (saved: boolean | null) => { if (saved === null) return; keep(saved); },',
        '});',
      );

      expect(result.changed).toBe(true);
      expect(result.findings).toEqual([]);
    });

    it('rewrites but reports a parameter that flows on unchecked', () => {
      const result = migrate(
        'createOverlayOpener(DEF, {',
        '  afterClosed: (choice: string | null) => (picked = choice),',
        '});',
      );

      expect(result.content).toContain('(choice: string | undefined) => (picked = choice)');
      expect(result.findings.map((entry) => entry.line)).toEqual([4]);
    });

    it('rewrites a method passed by reference that nothing else calls', () => {
      expect(
        migrate(
          'class A {',
          '  opener = createOverlayOpener(DEF, { afterClosed: this.onClosed });',
          '  private onClosed(saved: boolean | null) {',
          '    if (saved === null) return;',
          '  }',
          '}',
        ).content,
      ).toBe(
        file(
          'class A {',
          '  opener = createOverlayOpener(DEF, { afterClosed: this.onClosed });',
          '  private onClosed(saved: boolean | undefined) {',
          '    if (saved === undefined) return;',
          '  }',
          '}',
        ),
      );
    });

    it('rewrites the target of a forwarding arrow', () => {
      expect(
        migrate(
          'class A {',
          '  opener = createOverlayOpener(DEF, { afterClosed: (r) => this.handle(r) });',
          '  handle = (r: Item | null) => r;',
          '}',
        ).content,
      ).toBe(
        file(
          'class A {',
          '  opener = createOverlayOpener(DEF, { afterClosed: (r) => this.handle(r) });',
          '  handle = (r: Item | undefined) => r;',
          '}',
        ),
      );
    });

    it('reports a referenced method that something else calls too', () => {
      const result = migrate(
        'class A {',
        '  opener = createOverlayOpener(DEF, { afterClosed: this.onClosed });',
        '  ngOnInit() { this.onClosed(null); }',
        '  onClosed(saved: boolean | null) {}',
        '}',
      );

      expect(result.changed).toBe(false);
      expect(result.findings.map((entry) => entry.line)).toEqual([6]);
    });

    it('reports a callback imported from another file', () => {
      const result = migrate('createOverlayOpener(DEF, { afterClosed: handleClosed });');

      expect(result.findings).toEqual([
        expect.objectContaining({ line: 3, text: expect.stringContaining('handleClosed') }),
      ]);
    });

    it('reports a null callback in an object that does not go straight to an opener', () => {
      const result = migrate('const config = { afterClosed: (r: boolean | null) => r };');

      expect(result.changed).toBe(false);
      expect(result.findings.map((entry) => entry.line)).toEqual([3]);
    });

    it('rewrites a config field that only goes to openers', () => {
      expect(
        migrate(
          'class A {',
          '  private onSave = { afterClosed: (saved: boolean | null) => saved !== null };',
          '  private a = createOverlayOpener(A_DEF, this.onSave);',
          '  private b = createOverlayOpener(B_DEF, this.onSave);',
          '}',
        ).content,
      ).toContain('afterClosed: (saved: boolean | undefined) => saved !== undefined');
    });

    it('reports a config object that also goes somewhere else', () => {
      const result = migrate(
        'const onSave = { afterClosed: (saved: boolean | null) => saved };',
        'createOverlayOpener(A_DEF, onSave);',
        'keep(onSave);',
      );

      expect(result.changed).toBe(false);
      expect(result.findings.map((entry) => entry.line)).toEqual([3]);
    });

    it('reports an inferred result that goes on to another callback, at the call', () => {
      const result = migrate(
        'createOverlayOpener(DEF, {',
        '  afterClosed: (result) => {',
        '    const complete = this.complete;',
        '    complete?.(result);',
        '  },',
        '});',
      );

      expect(result.findings.map((entry) => entry.line)).toEqual([6]);
    });

    it('rewrites an object typed as an overlay config', () => {
      expect(
        migrate('const config: OverlayOpenerConfig<boolean> = { afterClosed: (r: boolean | null) => r };').content,
      ).toBe(file('const config: OverlayOpenerConfig<boolean> = { afterClosed: (r: boolean | undefined) => r };'));
    });

    it('ignores files that do not import @ethlete/components', () => {
      const source = 'createOverlayOpener(DEF, { afterClosed: (r: boolean | null) => r === null });\n';

      expect(migrateOverlayAndColumnApiInFile(source).changed).toBe(false);
    });
  });

  describe('injectCommandPalette', () => {
    it('renames the import and the call', () => {
      expect(
        migrateOverlayAndColumnApiInFile(
          "import { injectCommandPalette } from '@ethlete/components';\nconst palette = injectCommandPalette();\n",
        ).content,
      ).toBe(
        "import { createCommandPaletteOpener } from '@ethlete/components';\nconst palette = createCommandPaletteOpener();\n",
      );
    });

    it('does not import createCommandPaletteOpener twice', () => {
      expect(
        migrateOverlayAndColumnApiInFile(
          "import { createCommandPaletteOpener, injectCommandPalette } from '@ethlete/components';\n",
        ).content,
      ).toBe("import { createCommandPaletteOpener } from '@ethlete/components';\n");
    });
  });

  describe('TableColumnVisibilityHost', () => {
    it('renames the allColumns key of an annotated object', () => {
      expect(
        migrate(
          'const host: TableColumnVisibilityHost = {',
          '  allColumns: computed(() => cols),',
          '  showAllColumns,',
          '};',
        ).content,
      ).toBe(
        file(
          'const host: TableColumnVisibilityHost = {',
          '  availableColumns: computed(() => cols),',
          '  showAllColumns,',
          '};',
        ),
      );
    });

    it('expands a shorthand key in a satisfies object', () => {
      expect(migrate('const host = { allColumns, isColumnVisible } satisfies TableColumnVisibilityHost;').content).toBe(
        file('const host = { availableColumns: allColumns, isColumnVisible } satisfies TableColumnVisibilityHost;'),
      );
    });

    it('renames inside an arrow returning the host', () => {
      expect(migrate('const make = (): TableColumnVisibilityHost => ({ allColumns: cols });').content).toBe(
        file('const make = (): TableColumnVisibilityHost => ({ availableColumns: cols });'),
      );
    });

    it('renames reads through a value, a signal input and a local typed as the host', () => {
      expect(
        migrate(
          'function chooser(host: TableColumnVisibilityHost) { return host.allColumns(); }',
          'class A {',
          '  table = input<TableColumnVisibilityHost | undefined>(undefined);',
          '  a = computed(() => this.table()?.allColumns());',
          '  b = computed(() => { const t = this.table(); return t!.allColumns(); });',
          '}',
        ).content,
      ).toBe(
        file(
          'function chooser(host: TableColumnVisibilityHost) { return host.availableColumns(); }',
          'class A {',
          '  table = input<TableColumnVisibilityHost | undefined>(undefined);',
          '  a = computed(() => this.table()?.availableColumns());',
          '  b = computed(() => { const t = this.table(); return t!.availableColumns(); });',
          '}',
        ),
      );
    });

    it('reports a read it cannot follow at the read, not at the host declaration', () => {
      const result = migrate(
        'function chooser(hosts: TableColumnVisibilityHost[]) {',
        '  return hosts[0].allColumns();',
        '}',
      );

      expect(result.changed).toBe(false);
      expect(result.findings.map((entry) => entry.line)).toEqual([4]);
    });

    it('leaves allColumns reads on other types alone', () => {
      const source = file('const host: TableFeatureHost = table;', 'host.allColumns();');

      expect(migrateOverlayAndColumnApiInFile(source)).toEqual({ content: source, changed: false, findings: [] });
    });
  });

  describe('the generator', () => {
    it('writes the rewrites and warns with file:line for the rest without failing', () => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app-a/src/a.ts',
        file('createOverlayOpener(DEF, { afterClosed: (r: boolean | null) => log(r !== null) });'),
      );
      tree.write('apps/app-a/src/b.ts', file('createOverlayOpener(DEF, { afterClosed: handleClosed });'));

      return migrateOverlayAndColumnApi(tree, { skipFormat: true }).then((callback) => {
        expect(tree.read('apps/app-a/src/a.ts', 'utf-8')).toContain('(r: boolean | undefined) => log(r !== undefined)');
        expect(callback).toBeUndefined();
        const output = vi
          .mocked(console.log)
          .mock.calls.map((call) => call.join(' '))
          .join('\n');
        expect(output).toContain('WARN');
        expect(output).toMatch(/apps\/app-a\/src\/b\.ts:3:/);
      });
    });

    it('returns nothing when every site was rewritten', () => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/app-a/src/a.ts',
        file('createOverlayOpener(DEF, { afterClosed: (r: boolean | null) => log(r !== null) });'),
      );

      return migrateOverlayAndColumnApi(tree, { skipFormat: true }).then((callback) => {
        expect(callback).toBeUndefined();
      });
    });
  });
});
