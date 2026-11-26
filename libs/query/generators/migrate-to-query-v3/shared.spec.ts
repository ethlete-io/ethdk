import { pruneUnusedNamedImports } from './rename-symbols';
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

  it('keeps the default import when adding to a named import', () => {
    const content = "import Query, { a } from '@ethlete/query';";

    const result = ensureNamedImports({ content, importsNeeded: ['b'], moduleSpecifier: '@ethlete/query' });

    expect(result).toBe("import Query, { a, b } from '@ethlete/query';");
  });
});

describe('pruneUnusedNamedImports', () => {
  it('keeps import type and inline type modifiers', () => {
    const content = [
      "import type { A, Unused } from './types';",
      "import { type B, unusedValue } from './values';",
      '',
      'export const value: A | B = null!;',
    ].join('\n');

    const result = pruneUnusedNamedImports(content);

    expect(result).toContain("import type { A } from './types';");
    expect(result).toContain("import { type B } from './values';");
  });

  it('keeps a default import once every named import is pruned', () => {
    const result = pruneUnusedNamedImports("import value, { unused } from './values';\n\nexport const x = value;");

    expect(result).toBe("import value from './values';\n\nexport const x = value;");
  });
});
