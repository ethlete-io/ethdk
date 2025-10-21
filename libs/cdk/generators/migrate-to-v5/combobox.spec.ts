import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateCombobox } from './combobox';

describe('migrate-to-v5 -> combobox', () => {
  let tree: Tree;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('HTML templates', () => {
    it('should rename [emptyText] to [bodyEmptyText] in et-combobox', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox [emptyText]="'No items found'"></et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items found\'"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should rename emptyText attribute to bodyEmptyText in et-combobox', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox emptyText="No items found"></et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('bodyEmptyText="No items found"');
      expect(result).not.toContain('emptyText="No items found"');
    });

    it('should handle multiple emptyText properties on the same et-combobox', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox 
  [items]="items"
  [emptyText]="emptyMessage"
  emptyText="Default message">
</et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="emptyMessage"');
      expect(result).toContain('bodyEmptyText="Default message"');
      expect(result).not.toContain('[emptyText]');
      expect(result).not.toContain('emptyText="Default message"');
    });

    it('should handle multiple et-combobox elements', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox [emptyText]="'No users'"></et-combobox>
<et-combobox [emptyText]="'No items'"></et-combobox>
<et-combobox emptyText="No data"></et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No users\'"');
      expect(result).toContain('[bodyEmptyText]="\'No items\'"');
      expect(result).toContain('bodyEmptyText="No data"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should not affect emptyText on other components', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox [emptyText]="'No items'"></et-combobox>
<some-other-component [emptyText]="'Should not change'"></some-other-component>
<another-component emptyText="Also should not change"></another-component>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items\'"');
      expect(result).toContain('<some-other-component [emptyText]="\'Should not change\'">');
      expect(result).toContain('<another-component emptyText="Also should not change">');
    });

    it('should handle et-combobox with self-closing tags', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox [emptyText]="'No items'" />
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items\'"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should handle multi-line et-combobox tags', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox
  [items]="items"
  [emptyText]="emptyMessage"
  [placeholder]="'Select an item'">
</et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="emptyMessage"');
      expect(result).not.toContain('[emptyText]');
      expect(result).toContain('[placeholder]="\'Select an item\'"');
    });

    it('should not modify files without et-combobox', () => {
      const originalContent = `
<div [emptyText]="'Something'">
  <span>Content</span>
</div>
      `.trim();

      tree.write('test.component.html', originalContent);

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toBe(originalContent);
    });
  });

  describe('Inline templates', () => {
    it('should rename emptyText in inline template', () => {
      tree.write(
        'test.component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<et-combobox [emptyText]="emptyMessage"></et-combobox>',
})
export class TestComponent {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="emptyMessage"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should handle multi-line inline templates', () => {
      tree.write(
        'test.component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: \`
    <et-combobox
      [items]="items"
      [emptyText]="'No items found'"
      emptyText="Default">
    </et-combobox>
  \`,
})
export class TestComponent {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items found\'"');
      expect(result).toContain('bodyEmptyText="Default"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should not affect emptyText on other components in inline templates', () => {
      tree.write(
        'test.component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: \`
    <et-combobox [emptyText]="'No items'"></et-combobox>
    <other-component [emptyText]="'Should not change'"></other-component>
  \`,
})
export class TestComponent {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items\'"');
      expect(result).toContain('<other-component [emptyText]="\'Should not change\'">');
    });

    it('should handle multiple et-combobox in inline template', () => {
      tree.write(
        'test.component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: \`
    <et-combobox [emptyText]="'No users'"></et-combobox>
    <et-combobox emptyText="No data"></et-combobox>
  \`,
})
export class TestComponent {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No users\'"');
      expect(result).toContain('bodyEmptyText="No data"');
      expect(result).not.toContain('[emptyText]');
    });

    it('should not modify component files without et-combobox in template', () => {
      const originalContent = `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<div>No combobox here</div>',
})
export class TestComponent {}
      `.trim();

      tree.write('test.component.ts', originalContent);

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toBe(originalContent);
    });

    it('should handle single quotes in inline template', () => {
      tree.write(
        'test.component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<et-combobox [emptyText]="message"></et-combobox>',
})
export class TestComponent {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="message"');
      expect(result).not.toContain('[emptyText]');
    });
  });

  describe('Nested directories', () => {
    it('should process files in nested directories', () => {
      tree.write(
        'libs/feature/src/lib/components/test.component.html',
        '<et-combobox [emptyText]="message"></et-combobox>',
      );

      tree.write('apps/my-app/src/app/views/another.component.html', '<et-combobox emptyText="No data"></et-combobox>');

      migrateCombobox(tree);

      const result1 = tree.read('libs/feature/src/lib/components/test.component.html', 'utf-8');
      const result2 = tree.read('apps/my-app/src/app/views/another.component.html', 'utf-8');

      expect(result1).toContain('[bodyEmptyText]="message"');
      expect(result2).toContain('bodyEmptyText="No data"');
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle both HTML and TypeScript files in same migration', () => {
      tree.write('test1.component.html', '<et-combobox [emptyText]="message1"></et-combobox>');

      tree.write(
        'test2.component.ts',
        `
@Component({
  template: '<et-combobox [emptyText]="message2"></et-combobox>',
})
export class Test2Component {}
        `.trim(),
      );

      migrateCombobox(tree);

      const result1 = tree.read('test1.component.html', 'utf-8');
      const result2 = tree.read('test2.component.ts', 'utf-8');

      expect(result1).toContain('[bodyEmptyText]="message1"');
      expect(result2).toContain('[bodyEmptyText]="message2"');
    });

    it('should preserve other attributes and bindings', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox
  [items]="items"
  [placeholder]="'Select'"
  [emptyText]="'No items'"
  [disabled]="isDisabled"
  (selectionChange)="onSelect($event)">
</et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[items]="items"');
      expect(result).toContain('[placeholder]="\'Select\'"');
      expect(result).toContain('[bodyEmptyText]="\'No items\'"');
      expect(result).toContain('[disabled]="isDisabled"');
      expect(result).toContain('(selectionChange)="onSelect($event)"');
    });
  });

  describe('Console output', () => {
    it('should log when files are modified', () => {
      tree.write('test.component.html', '<et-combobox [emptyText]="message"></et-combobox>');

      migrateCombobox(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating <et-combobox> components...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ test.component.html: renamed 1 property(ies)'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Migrated 1 file(s), renamed 1 emptyText property(ies) to bodyEmptyText'),
      );
    });

    it('should log when no files need migration', () => {
      tree.write('test.component.html', '<div>No combobox</div>');

      migrateCombobox(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating <et-combobox> components...');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✅ No <et-combobox> components found that need migration');
    });

    it('should count multiple properties correctly', () => {
      tree.write(
        'test.component.html',
        `
<et-combobox [emptyText]="message1"></et-combobox>
<et-combobox [emptyText]="message2"></et-combobox>
<et-combobox emptyText="Static"></et-combobox>
        `.trim(),
      );

      migrateCombobox(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('renamed 3 emptyText property(ies) to bodyEmptyText'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle et-combobox with no emptyText property', () => {
      const originalContent = '<et-combobox [items]="items"></et-combobox>';
      tree.write('test.component.html', originalContent);

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toBe(originalContent);
    });

    it('should handle empty files', () => {
      tree.write('empty.component.html', '');

      migrateCombobox(tree);

      const result = tree.read('empty.component.html', 'utf-8');
      expect(result).toBe('');
    });

    it('should handle files with only whitespace', () => {
      tree.write('whitespace.component.html', '   \n  \n  ');

      migrateCombobox(tree);

      const result = tree.read('whitespace.component.html', 'utf-8');
      expect(result).toBe('   \n  \n  ');
    });

    it('should handle et-combobox with special characters in emptyText', () => {
      tree.write('test.component.html', `<et-combobox [emptyText]="'No items (0/10) - 100%'"></et-combobox>`);

      migrateCombobox(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('[bodyEmptyText]="\'No items (0/10) - 100%\'"');
    });

    it('should ignore files that are not HTML or TypeScript', () => {
      tree.write('test.scss', '.et-combobox { emptyText: "test"; }');
      tree.write('test.json', '{ "emptyText": "test" }');

      migrateCombobox(tree);

      expect(tree.read('test.scss', 'utf-8')).toContain('emptyText');
      expect(tree.read('test.json', 'utf-8')).toContain('emptyText');
    });
  });
});
