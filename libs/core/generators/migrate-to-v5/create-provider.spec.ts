import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import migrateCreateProvider from './create-provider';

describe('migrate-to-v5 -> create provider', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should replace createProvider import from @ethlete/cdk to @ethlete/core', async () => {
    const input = `import { createProvider } from '@ethlete/cdk';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    const expected = `import { createProvider } from '@ethlete/core';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(expected);
  });

  it('should update createProvider when mixed with other imports from @ethlete/cdk', async () => {
    const input = `import { createProvider, SomethingElse } from '@ethlete/cdk';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    const expected = `import { createProvider } from '@ethlete/core';
import { SomethingElse } from '@ethlete/cdk';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(expected);
  });

  it('should not modify files without createProvider import', async () => {
    const input = `import { SomethingElse } from '@ethlete/cdk';

export class MyClass {}`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(input);
  });

  it('should not modify if createProvider is already imported from @ethlete/core', async () => {
    const input = `import { createProvider } from '@ethlete/core';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(input);
  });

  it('should handle createProvider as the only import from @ethlete/cdk', async () => {
    const input = `import { createProvider } from '@ethlete/cdk';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    const expected = `import { createProvider } from '@ethlete/core';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(expected);
  });

  it('should add new import line if @ethlete/core import already exists', async () => {
    const input = `import { createProvider } from '@ethlete/cdk';
import { AnotherThing } from '@ethlete/core';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    const expected = `import { AnotherThing , createProvider} from '@ethlete/core';

export const MyProvider = createProvider(() => {
  return { value: 42 };
});`;

    tree.write('test.ts', input);
    await migrateCreateProvider(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe(expected);
  });
});
