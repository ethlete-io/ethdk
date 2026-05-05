// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./inject-member-accessibility');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const INLINE_COMPONENT_PROTECTED = [
  '@Component({',
  '  template: `@if (buttonDir.loading()) { <div></div> }`',
  '})',
  'class Foo {',
  '  protected buttonDir = inject(ButtonDirective);',
  '}',
].join('\n');

const INLINE_COMPONENT_PRIVATE = [
  '@Component({',
  '  template: `@if (buttonDir.loading()) { <div></div> }`',
  '})',
  'class Foo {',
  '  private buttonDir = inject(ButtonDirective);',
  '}',
].join('\n');

const INLINE_COMPONENT_IMPLICIT = [
  '@Component({',
  '  template: `@if (buttonDir.loading()) { <div></div> }`',
  '})',
  'class Foo {',
  '  buttonDir = inject(ButtonDirective);',
  '}',
].join('\n');

tester.run('inject-member-accessibility', rule, {
  valid: [
    { code: `class Foo { private service = inject(MyService); }` },
    { code: `class Foo { public service = inject(MyService); }` },
    { code: INLINE_COMPONENT_PROTECTED },
    {
      code: `
        @Directive({
          host: {
            '[attr.aria-busy]': 'buttonDir.loading() ? true : null',
          },
        })
        class Foo {
          protected buttonDir = inject(ButtonDirective);
        }
      `,
    },
  ],
  invalid: [
    {
      code: `class Foo { service = inject(MyService); }`,
      output: `class Foo { private service = inject(MyService); }`,
      errors: [{ messageId: 'shouldBePrivate' }],
    },
    {
      code: `class Foo { protected service = inject(MyService); }`,
      output: `class Foo { private service = inject(MyService); }`,
      errors: [{ messageId: 'shouldBePrivate' }],
    },
    {
      code: INLINE_COMPONENT_PRIVATE,
      output: INLINE_COMPONENT_PROTECTED,
      errors: [{ messageId: 'shouldBeProtected' }],
    },
    {
      code: [
        '@Component({',
        '  template: `{{ buttonDir.loading() }}`',
        '})',
        'class Foo {',
        '  public buttonDir = inject(ButtonDirective);',
        '}',
      ].join('\n'),
      output: [
        '@Component({',
        '  template: `{{ buttonDir.loading() }}`',
        '})',
        'class Foo {',
        '  protected buttonDir = inject(ButtonDirective);',
        '}',
      ].join('\n'),
      errors: [{ messageId: 'shouldBeProtected' }],
    },
    {
      code: INLINE_COMPONENT_IMPLICIT,
      output: INLINE_COMPONENT_PROTECTED,
      errors: [{ messageId: 'shouldBeProtected' }],
    },
    {
      code: `
        @Directive({
          host: {
            '[attr.aria-busy]': 'buttonDir.loading() ? true : null',
          },
        })
        class Foo {
          private buttonDir = inject(ButtonDirective);
        }
      `,
      output: `
        @Directive({
          host: {
            '[attr.aria-busy]': 'buttonDir.loading() ? true : null',
          },
        })
        class Foo {
          protected buttonDir = inject(ButtonDirective);
        }
      `,
      errors: [{ messageId: 'shouldBeProtected' }],
    },
  ],
});
