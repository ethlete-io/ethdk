import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import migrateIsActiveElement from './is-active-element';

function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

describe('migrate-to-v5 -> is-active-element', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // do nothing
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('TypeScript migrations', () => {
    it('should replace IsActiveElementDirective with ScrollableImports in imports', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';

@Component({
  imports: [IsActiveElementDirective],
  template: '<div etIsActiveElement></div>',
})
export class TestComponent {}`;

      const expected = `import { Component } from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports],
  template: '<div etScrollableIsActiveChild></div>',
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should replace IS_ACTIVE_ELEMENT token with SCROLLABLE_IS_ACTIVE_CHILD_TOKEN', async () => {
      const input = `import { inject } from '@angular/core';
import { IS_ACTIVE_ELEMENT } from '@ethlete/core';

export class TestClass {
  private readonly directive = inject(IS_ACTIVE_ELEMENT);
}`;

      const expected = `import { inject } from '@angular/core';
import { SCROLLABLE_IS_ACTIVE_CHILD_TOKEN } from '@ethlete/cdk';

export class TestClass {
  private readonly directive = inject(SCROLLABLE_IS_ACTIVE_CHILD_TOKEN);
}`;

      tree.write('test.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should add ScrollableImports when not already present', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';
import { SomeOtherDirective } from '@ethlete/cdk';

@Component({
  imports: [IsActiveElementDirective, SomeOtherDirective],
})
export class TestComponent {}`;

      const expected = `import { Component } from '@angular/core';
import { ScrollableImports, SomeOtherDirective } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports, SomeOtherDirective],
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should not duplicate ScrollableImports if already present', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [IsActiveElementDirective, ScrollableImports],
})
export class TestComponent {}`;

      const expected = `import { Component } from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports, ScrollableImports],
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should remove @ethlete/core import if IsActiveElementDirective was the only import', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';

@Component({
  imports: [IsActiveElementDirective],
})
export class TestComponent {}`;

      const expected = `import { Component } from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports],
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });

    it('should keep other @ethlete/core imports', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective, SomeOtherUtility } from '@ethlete/core';

@Component({
  imports: [IsActiveElementDirective],
})
export class TestComponent {
  util = SomeOtherUtility;
}`;

      const expected = `import { Component } from '@angular/core';
import { SomeOtherUtility } from '@ethlete/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports],
})
export class TestComponent {
  util = SomeOtherUtility;
}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });

  describe('HTML template migrations', () => {
    it('should replace etIsActiveElement selector with etScrollableIsActiveChild', async () => {
      const input = `<div class="container">
  <button etIsActiveElement>Click me</button>
  <span etIsActiveElement>Active</span>
</div>`;

      const expected = `<div class="container">
  <button etScrollableIsActiveChild>Click me</button>
  <span etScrollableIsActiveChild>Active</span>
</div>`;

      tree.write('test.component.html', input);
      await migrateIsActiveElement(tree);

      expect(tree.read('test.component.html', 'utf-8')).toBe(expected);
    });

    it('should handle etIsActiveElement with other attributes', async () => {
      const input = `<div etIsActiveElement class="active" [attr.disabled]="true"></div>`;

      const expected = `<div etScrollableIsActiveChild class="active" [attr.disabled]="true"></div>`;

      tree.write('test.component.html', input);
      await migrateIsActiveElement(tree);

      expect(tree.read('test.component.html', 'utf-8')).toBe(expected);
    });
  });

  describe('combined migrations', () => {
    it('should migrate both TypeScript and HTML files in the same component', async () => {
      const tsInput = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';

@Component({
  imports: [IsActiveElementDirective],
  templateUrl: './test.component.html',
})
export class TestComponent {}`;

      const htmlInput = `<div etIsActiveElement>Content</div>`;

      const expectedTs = `import { Component } from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports],
  templateUrl: './test.component.html',
})
export class TestComponent {}`;

      const expectedHtml = `<div etScrollableIsActiveChild>Content</div>`;

      tree.write('test.component.ts', tsInput);
      tree.write('test.component.html', htmlInput);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expectedTs));
      expect(tree.read('test.component.html', 'utf-8')).toBe(expectedHtml);
    });
  });

  describe('edge cases', () => {
    it('should not modify files without IsActiveElementDirective', async () => {
      const input = `import { Component } from '@angular/core';

@Component({
  template: '<div>No directive here</div>',
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(tree.read('test.component.ts', 'utf-8')).toBe(input);
    });

    it('should handle inline templates with etIsActiveElement', async () => {
      const input = `import { Component } from '@angular/core';
import { IsActiveElementDirective } from '@ethlete/core';

@Component({
  imports: [IsActiveElementDirective],
  template: '<div etIsActiveElement>Inline</div>',
})
export class TestComponent {}`;

      const expected = `import { Component } from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';

@Component({
  imports: [ScrollableImports],
  template: '<div etScrollableIsActiveChild>Inline</div>',
})
export class TestComponent {}`;

      tree.write('test.component.ts', input);
      await migrateIsActiveElement(tree);

      expect(normalizeCode(tree.read('test.component.ts', 'utf-8')!)).toBe(normalizeCode(expected));
    });
  });
});
