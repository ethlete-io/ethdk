// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./class-constant-property');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('class-constant-property', rule, {
  valid: [
    { code: `class Foo { readonly ID = nextId++; }` },
    { code: `class Foo { readonly RESIZE_EDGES = [ResizeEdge.LEFT, ResizeEdge.RIGHT]; }` },
    { code: `class Foo { id = nextId++; update() { this.id = nextId++; } }` },
    { code: `class Foo { count = signal(0); }` },
    { code: `class Foo { form = new FormGroup({}); }` },
    { code: `class Foo { readonly BASE = 2; value = this.BASE * 2; }` },
  ],
  invalid: [
    {
      code: `class Foo { ID = nextId++; }`,
      output: `class Foo { readonly ID = nextId++; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo { private OPTIONS = [A, B]; }`,
      output: `class Foo { private readonly OPTIONS = [A, B]; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo { BASE = 2; value = this.BASE * 2; }`,
      output: `class Foo { readonly BASE = 2; value = this.BASE * 2; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo { readonly id = nextId++; }`,
      errors: [{ messageId: 'shouldUseScreamingCase' }],
    },
    {
      code: `class Foo { readonly resizeEdges = [ResizeEdge.LEFT, ResizeEdge.RIGHT]; }`,
      errors: [{ messageId: 'shouldUseScreamingCase' }],
    },
  ],
});
