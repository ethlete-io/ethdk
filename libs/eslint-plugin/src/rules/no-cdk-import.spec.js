// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-cdk-import');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

// The repo's own copy of the map the published package ships, so the messages under test are the real ones.
const withMap = [{ migrationMapPath: '../cdk/migration-map.json', docsBaseUrl: 'https://docs.example.com' }];

tester.run('no-cdk-import', rule, {
  valid: [
    {
      code: `import { ButtonComponent } from '@ethlete/components';`,
      filename: 'test.ts',
      options: withMap,
    },
    {
      code: `import { injectAnimatedLifecycle } from '@ethlete/core';`,
      filename: 'test.ts',
      options: withMap,
    },
    // A package that merely starts the same way
    {
      code: `import { thing } from '@ethlete/cdk-adjacent';`,
      filename: 'test.ts',
      options: withMap,
    },
  ],
  invalid: [
    {
      code: `import { ButtonComponent } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [
        {
          message:
            '`ButtonComponent` is legacy @ethlete/cdk. Use `ButtonComponent` from @ethlete/components instead (https://docs.example.com/components/button). a real button system: variant, size and color inputs plus theming instead of CSS-only classes.',
        },
      ],
    },
    // A renamed symbol names the new identifier
    {
      code: `import { ACCORDION_COMPONENT } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [
        {
          message:
            '`ACCORDION_COMPONENT` is legacy @ethlete/cdk. Use `ACCORDION_TOKEN` from @ethlete/components instead (https://docs.example.com/components/accordion).',
        },
      ],
    },
    // A successor in another package
    {
      code: `import { AnimatedOverlayState } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [
        {
          message:
            '`AnimatedOverlayState` is legacy @ethlete/cdk. Use `AnimatedLifecycleState` from @ethlete/core instead (https://docs.example.com/cdk/migration). the mount lifecycle is the core animated-lifecycle state.',
        },
      ],
    },
    {
      code: `import { ACCORDION_HINT_WRAPPER_DIRECTIVE } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [
        {
          message:
            '`ACCORDION_HINT_WRAPPER_DIRECTIVE` is legacy @ethlete/cdk and has no successor (the hint template is a content query on the accordion, not a DI token) - see https://docs.example.com/cdk/migration.',
        },
      ],
    },
    // Not in the map at all - still reported, without a specific successor
    {
      code: `import { SomethingNeverPublished } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [{ messageId: 'unmapped' }],
    },
    // No map on disk: every import still reports
    {
      code: `import { ButtonComponent } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: [{ migrationMapPath: './does-not-exist.json' }],
      errors: [{ messageId: 'unmapped' }],
    },
    // Subpaths and non-named imports
    {
      code: `import { ButtonComponent } from '@ethlete/cdk/button';`,
      filename: 'test.ts',
      options: withMap,
      errors: [{ messageId: 'successor' }],
    },
    {
      code: `import '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [{ messageId: 'module' }],
    },
    {
      code: `import * as cdk from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [{ messageId: 'module' }],
    },
    // Every named import is reported, not just the first
    {
      code: `import { ButtonComponent, ACCORDION_COMPONENT } from '@ethlete/cdk';`,
      filename: 'test.ts',
      options: withMap,
      errors: [{ messageId: 'successor' }, { messageId: 'successor' }],
    },
  ],
});
