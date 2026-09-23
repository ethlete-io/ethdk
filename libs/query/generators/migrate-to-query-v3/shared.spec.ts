import { ensureNamedImports } from './shared';

describe('ensureNamedImports', () => {
  it('adds a value import to the value import, not to a later type-only import of the module', () => {
    const content = [
      "import { injectQueryClient } from '@ethlete/query';",
      "import type { QueryConfig } from '@ethlete/query';",
    ].join('\n');

    const result = ensureNamedImports({
      content,
      importsNeeded: ['provideQueryDevtools'],
      moduleSpecifier: '@ethlete/query',
    });

    expect(result).toContain("import { injectQueryClient, provideQueryDevtools } from '@ethlete/query';");
    expect(result).toContain("import type { QueryConfig } from '@ethlete/query';");
  });

  it('adds to the first value import when the module is imported more than once', () => {
    const content = ["import { a } from '@ethlete/query';", "import { b } from '@ethlete/query';"].join('\n');

    const result = ensureNamedImports({ content, importsNeeded: ['c'], moduleSpecifier: '@ethlete/query' });

    expect(result).toContain("import { a, c } from '@ethlete/query';");
    expect(result).toContain("import { b } from '@ethlete/query';");
  });

  it('adds a new import when the module is only imported as types', () => {
    const content = "import type { QueryConfig } from '@ethlete/query';";

    const result = ensureNamedImports({
      content,
      importsNeeded: ['provideQueryDevtools'],
      moduleSpecifier: '@ethlete/query',
    });

    expect(result).toBe(
      "import type { QueryConfig } from '@ethlete/query';\nimport { provideQueryDevtools } from '@ethlete/query';",
    );
  });
});
