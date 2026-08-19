// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('./prefer-static-boolean-properties');

const tester = new RuleTester({
  languageOptions: {
    parser: /** @type {any} */ (templateParser),
  },
});

tester.run('prefer-static-boolean-properties', rule, {
  valid: [
    // Dynamic expression — a real binding
    {
      code: `<my-cmp [isReadonly]="isReadonly()" />`,
      filename: 'test.html',
    },
    // Negated expression is not a literal
    {
      code: `<my-cmp [isReadonly]="!editable" />`,
      filename: 'test.html',
    },
    // Already a bare attribute
    {
      code: `<my-cmp isReadonly />`,
      filename: 'test.html',
    },
    // Already a static attribute
    {
      code: `<my-cmp isReadonly="false" />`,
      filename: 'test.html',
    },
    // String literal — covered by @angular-eslint/template/prefer-static-string-properties
    {
      code: `<my-cmp [mode]="'true'" />`,
      filename: 'test.html',
    },
    // class. / style. / attr. sub-property bindings must stay bindings
    {
      code: `<div [class.active]="true"></div>`,
      filename: 'test.html',
    },
    {
      code: `<button [attr.aria-expanded]="true"></button>`,
      filename: 'test.html',
    },
    // Structural directive micro-syntax
    {
      code: `<div *ngIf="true"></div>`,
      filename: 'test.html',
    },
    {
      code: `<button [disabled]="false">Save</button>`,
      filename: 'test.html',
    },
    {
      code: `<input type="checkbox" [checked]="false" />`,
      filename: 'test.html',
    },
    {
      code: `<ng-template [ngIf]="true"></ng-template>`,
      filename: 'test.html',
    },
  ],
  invalid: [
    {
      code: `<my-cmp [isReadonly]="true" />`,
      filename: 'test.html',
      errors: [
        {
          messageId: 'preferStaticBooleanProperty',
          suggestions: [
            {
              messageId: 'useBareAttribute',
              output: `<my-cmp isReadonly />`,
            },
          ],
        },
      ],
    },
    {
      code: `<my-cmp [isReadonly]="false" />`,
      filename: 'test.html',
      errors: [
        {
          messageId: 'preferStaticBooleanProperty',
          suggestions: [
            {
              messageId: 'useStaticAttribute',
              output: `<my-cmp isReadonly="false" />`,
            },
          ],
        },
      ],
    },
    // Whitespace around the literal still counts as static
    {
      code: `<my-cmp [isReadonly]=" true " />`,
      filename: 'test.html',
      errors: [
        {
          messageId: 'preferStaticBooleanProperty',
          suggestions: [
            {
              messageId: 'useBareAttribute',
              output: `<my-cmp isReadonly />`,
            },
          ],
        },
      ],
    },
    // Multiple bindings on one element are each flagged
    {
      code: `<my-cmp [isActive]="true" [isReadonly]="false" />`,
      filename: 'test.html',
      errors: [
        {
          messageId: 'preferStaticBooleanProperty',
          suggestions: [
            {
              messageId: 'useBareAttribute',
              output: `<my-cmp isActive [isReadonly]="false" />`,
            },
          ],
        },
        {
          messageId: 'preferStaticBooleanProperty',
          suggestions: [
            {
              messageId: 'useStaticAttribute',
              output: `<my-cmp [isActive]="true" isReadonly="false" />`,
            },
          ],
        },
      ],
    },
  ],
});
