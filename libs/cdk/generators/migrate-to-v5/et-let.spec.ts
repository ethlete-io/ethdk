import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateEtLet } from './et-let';

describe('migrate-to-v5 -> *etLet', () => {
  let tree: Tree;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('HTML templates', () => {
    it('should convert *etLet on ng-container to @let', () => {
      tree.write(
        'test.component.html',
        `<ng-container *etLet="user$ | async as user">
  <div>{{ user.name }}</div>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let user = user$ | async;');
      expect(result).toContain('<div>{{ user.name }}</div>');
      expect(result).not.toContain('ng-container');
      expect(result).not.toContain('*etLet');
    });

    it('should convert *ngLet on ng-container to @let', () => {
      tree.write(
        'test.component.html',
        `<ng-container *ngLet="value$ | async as value">
  <span>{{ value }}</span>
</ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let value = value$ | async;');
      expect(result).not.toContain('*ngLet');
    });

    it('should convert *etLet on regular element', () => {
      tree.write('test.component.html', `<div *etLet="value as v">{{ v }}</div>`);

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('@let v = value;');
      expect(result).toContain('<div>{{ v }}</div>');
      expect(result).not.toContain('*etLet');
    });

    it('should preserve indentation', () => {
      tree.write(
        'test.component.html',
        `  <ng-container *etLet="value as v">
    <div>{{ v }}</div>
  </ng-container>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');
      expect(result).toContain('  @let v = value;');
    });

    it('should handle multiple *etLet directives in the same file', () => {
      tree.write(
        'test.component.html',
        `<ng-container *etLet="user$ | async as user">
  <div>{{ user.name }}</div>
</ng-container>

<ng-container *etLet="items$ | async as items">
  <div>{{ items.length }}</div>
</ng-container>

<div *etLet="count as c">{{ c }}</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that all three @let statements are present
      expect(result).toContain('@let user = user$ | async;');
      expect(result).toContain('@let items = items$ | async;');
      expect(result).toContain('@let c = count;');

      // Check that content is preserved
      expect(result).toContain('<div>{{ user.name }}</div>');
      expect(result).toContain('<div>{{ items.length }}</div>');
      expect(result).toContain('<div>{{ c }}</div>');

      // Check that no *etLet directives remain
      expect(result).not.toContain('*etLet');
      expect(result).not.toContain('ng-container');

      // Verify the structure is not corrupted
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(3);
    });

    it('should handle complex nested structure with multiple *ngLet directives', () => {
      tree.write(
        'test.component.html',
        `<div class="container">
  <ol class="list">
    <ng-container *ngLet="selectedMemberAssociationsMap$ | async as selectedMemberAssociations">
      @if (store.response$ | async; as response) {
        @for (memberAssociation of response.items; track trackByFn($index, memberAssociation)) {
          <li>
            <button
              [disabled]="selectedMemberAssociations?.[memberAssociation!.id]"
              (click)="addItem(memberAssociation!.id)"
              class="button"
            >
              <div
                *ngLet="memberAssociation?.countryFlag | parseImage as countryFlag"
                [ngClass]="{
                  'rounded': !countryFlag,
                  'opacity-30': selectedMemberAssociations?.[memberAssociation!.id],
                }"
                class="flag-container"
              >
                @if (countryFlag) {
                  <img [src]="countryFlag" [alt]="memberAssociation?.countryName" />
                }
              </div>
              <span>{{ memberAssociation?.countryName }}</span>
            </button>
          </li>
        }
      }
    </ng-container>
  </ol>
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check that both @let statements are present
      expect(result).toContain('@let selectedMemberAssociations = selectedMemberAssociationsMap$ | async;');
      expect(result).toContain('@let countryFlag = memberAssociation?.countryFlag | parseImage;');

      // Check that the nested structure is preserved
      expect(result).toContain('@if (store.response$ | async; as response)');
      expect(result).toContain('@for (memberAssociation of response.items;');
      expect(result).toContain('[disabled]="selectedMemberAssociations?.[memberAssociation!.id]"');
      expect(result).toContain('selectedMemberAssociations?.[memberAssociation!.id]');
      expect(result).toContain('@if (countryFlag)');

      // Check that no *ngLet or ng-container remains
      expect(result).not.toContain('*ngLet');
      expect(result).not.toContain('ng-container');

      // Verify both @let statements exist
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(2);
    });

    it('should handle deeply nested *etLet with control flow', () => {
      tree.write(
        'test.component.html',
        `<div class="wrapper">
  @if (listStore$ | async; as store) {
    <ol class="list">
      <ng-container *etLet="selectedItems$ | async as selectedItems">
        @for (item of store.items; track item.id) {
          <li>
            <div *etLet="item.image | parseImage as parsedImage" class="image-wrapper">
              @if (parsedImage) {
                <img [src]="parsedImage" />
              }
              <span>{{ item.name }}</span>
              @if (!selectedItems?.[item.id]) {
                <button (click)="select(item.id)">Select</button>
              }
            </div>
          </li>
        }
      </ng-container>
    </ol>
  }
</div>`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.html', 'utf-8');

      // Check both @let statements
      expect(result).toContain('@let selectedItems = selectedItems$ | async;');
      expect(result).toContain('@let parsedImage = item.image | parseImage;');

      // Verify structure preservation
      expect(result).toContain('@if (listStore$ | async; as store)');
      expect(result).toContain('@for (item of store.items; track item.id)');
      expect(result).toContain('@if (parsedImage)');
      expect(result).toContain('@if (!selectedItems?.[item.id])');

      // No directives remain
      expect(result).not.toContain('*etLet');
      expect(result).not.toContain('ng-container');

      // Count @let statements
      const lines = result!.split('\n');
      expect(lines.filter((l) => l.includes('@let')).length).toBe(2);
    });

    it('should not modify files without *etLet or *ngLet', () => {
      const original = '<div>No etLet here</div>';
      tree.write('test.component.html', original);

      migrateEtLet(tree);

      expect(tree.read('test.component.html', 'utf-8')).toBe(original);
    });
  });

  describe('Inline templates', () => {
    it('should convert *etLet in inline templates', () => {
      tree.write(
        'test.component.ts',
        `@Component({
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('@let v = value;');
      expect(result).not.toContain('*etLet');
    });

    it('should handle template literals', () => {
      tree.write(
        'test.component.ts',
        `@Component({
  template: \`
    <ng-container *etLet="user$ | async as user">
      <div>{{ user.name }}</div>
    </ng-container>
  \`,
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('@let user = user$ | async;');
      expect(result).not.toContain('ng-container');
    });
  });

  describe('Import removal', () => {
    it('should remove LetDirective from imports array', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain('LetDirective');
      expect(result).not.toContain('imports: [LetDirective]');
    });

    it('should remove NgLetDirective from imports array', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { NgLetDirective } from '@angular/common';

@Component({
  selector: 'app-test',
  imports: [NgLetDirective],
  template: '<ng-container *ngLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain('NgLetDirective');
    });

    it('should preserve other imports when removing LetDirective', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { CommonModule, LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [CommonModule, LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).toContain('CommonModule');
      expect(result).not.toContain('LetDirective');
      expect(result).toContain('imports: [CommonModule]');
    });

    it('should remove entire import statement if only LetDirective', () => {
      tree.write(
        'test.component.ts',
        `import { Component } from '@angular/core';
import { LetDirective } from '@ethlete/cdk';

@Component({
  selector: 'app-test',
  imports: [LetDirective],
  template: '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>',
})
export class TestComponent {}`,
      );

      migrateEtLet(tree);

      const result = tree.read('test.component.ts', 'utf-8');
      expect(result).not.toContain("from '@ethlete/cdk'");
    });
  });

  describe('Console output', () => {
    it('should log when directives are converted', () => {
      tree.write('test.component.html', '<ng-container *etLet="value as v"><div>{{ v }}</div></ng-container>');

      migrateEtLet(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating *etLet and *ngLet');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ test.component.html: converted 1 directive(s)'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Migrated 1 file(s)'));
    });

    it('should log when no directives are found', () => {
      tree.write('test.component.html', '<div>No etLet</div>');

      migrateEtLet(tree);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n🔄 Migrating *etLet and *ngLet');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✅ No *etLet or *ngLet directives found that need migration');
    });
  });
});
