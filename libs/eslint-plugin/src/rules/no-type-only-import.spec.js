// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-type-only-import');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-type-only-import', rule, {
  valid: [
    // Regular value imports — fine
    { code: `import { Foo } from 'bar';` },
    { code: `import { Component, OnInit } from '@angular/core';` },
    { code: `import { Signal, WritableSignal } from '@angular/core';` },
  ],
  invalid: [
    {
      // import type statement
      code: `import type { Foo } from 'bar';`,
      output: `import { Foo } from 'bar';`,
      errors: [{ messageId: 'noTypeImportDeclaration' }],
    },
    {
      // Inline type specifier
      code: `import { type Foo } from 'bar';`,
      output: `import { Foo } from 'bar';`,
      errors: [{ messageId: 'noInlineTypeSpecifier' }],
    },
    {
      // Multiple inline type specifiers
      code: `import { type A, type B } from 'baz';`,
      output: `import { A, B } from 'baz';`,
      errors: [{ messageId: 'noInlineTypeSpecifier' }, { messageId: 'noInlineTypeSpecifier' }],
    },
  ],
});
