// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-legacy-query-import');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

const options = [{ docsBaseUrl: 'https://docs.example.com' }];

tester.run('no-legacy-query-import', rule, {
  valid: [
    {
      code: `import { createQueryClient, createGetQuery } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
    },
    // The sanctioned interop seam a migration runs on
    {
      code: `import { createLegacyQueryCreator } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
    },
    // Current-system names that merely read like the legacy ones
    {
      code: `import { QueryClient, validateWithQuery } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
    },
    // Another package's symbol of the same name is none of this rule's business
    {
      code: `import { EntityStore } from '@my-org/state';`,
      filename: 'test.ts',
      options,
    },
  ],
  invalid: [
    {
      code: `import { V2QueryClient } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [
        {
          message:
            '`V2QueryClient` is the legacy (v2) query system. Use `createQueryClient` instead (https://docs.example.com/query/queries#the-query-client).',
        },
      ],
    },
    {
      code: `import { InfinityQuery } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [
        {
          message:
            '`InfinityQuery` is the legacy (v2) query system. Use `createPagedQueryStack` instead (https://docs.example.com/query/stacks#paged-queries).',
        },
      ],
    },
    // A V2 symbol with no curated successor still reports, pointing at the guide and the codemod
    {
      code: `import { V2QueryState } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [{ messageId: 'legacySystem' }],
    },
    {
      code: `import { AnyV2Query } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [{ messageId: 'legacySystem' }],
    },
    {
      code: `import { def, filterSuccess, toQuerySignal } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [{ messageId: 'successor' }, { messageId: 'successor' }, { messageId: 'successor' }],
    },
    // An alias does not hide it
    {
      code: `import { QueryDirective as EtQuery } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [{ messageId: 'successor' }],
    },
    // Mixed import: only the legacy half is reported
    {
      code: `import { createGetQuery, V2BearerAuthProvider } from '@ethlete/query';`,
      filename: 'test.ts',
      options,
      errors: [{ messageId: 'successor' }],
    },
  ],
});
