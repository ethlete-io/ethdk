import { describe, expect, it } from 'vitest';
import { scanQueryErrorLabelsInFile } from './query-error-labels';

describe('migrate-query-error-labels', () => {
  it('reports a template using et-query-error', () => {
    const { usages, hasLabelProvider } = scanQueryErrorLabelsInFile(
      'apps/shop/src/app/users.component.html',
      '@if (usersQuery.error(); as error) {\n<et-query-error [error]="error" />\n}',
    );

    expect(hasLabelProvider).toBe(false);
    expect(usages).toEqual([
      {
        id: 'query-error-labels--apps-shop-src-app-users-component-html',
        file: 'apps/shop/src/app/users.component.html',
        line: 2,
        message: expect.stringContaining('et-query-error'),
      },
    ]);
  });

  it('reports headless and imports-barrel usage in TS', () => {
    const { usages } = scanQueryErrorLabelsInFile(
      'apps/shop/src/app/users.component.ts',
      "import { QUERY_ERROR_IMPORTS } from '@ethlete/components';",
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]?.message).toContain('QUERY_ERROR_IMPORTS');
  });

  it('detects an existing label provider', () => {
    const { usages, hasLabelProvider } = scanQueryErrorLabelsInFile(
      'apps/shop/src/app/app.config.ts',
      "providers: [provideQueryErrorLabels({ retry: 'Nochmal' })],",
    );

    expect(hasLabelProvider).toBe(true);
    expect(usages).toHaveLength(0);
  });

  it('ignores unrelated files', () => {
    const { usages, hasLabelProvider } = scanQueryErrorLabelsInFile(
      'apps/shop/src/app/other.ts',
      'export const nothing = 1;',
    );

    expect(usages).toHaveLength(0);
    expect(hasLabelProvider).toBe(false);
  });
});
