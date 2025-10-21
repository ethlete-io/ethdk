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
