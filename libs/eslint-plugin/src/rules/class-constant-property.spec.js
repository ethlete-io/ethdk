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
    {
      code: `@Component({ template: '<button (click)="isOpen = !isOpen">x</button><input [(ngModel)]="query">' })
class C { protected isOpen = false; protected query = ''; }`,
    },
    { code: `@Directive({ host: { '(click)': 'pressed = true' } }) class D { protected pressed = false; }` },
    { code: `@Component({ template: '' }) class C { label = 'x'; public size = 'md'; }` },
    {
      code: `import { Pipe as NgPipe } from '@angular/core';
@NgPipe({ name: 'x' }) class P { transform = identity; }`,
    },
    { code: `class Foo { readonly ID = nextId++; }` },
    { code: `class Foo { readonly RESIZE_EDGES = [ResizeEdge.LEFT, ResizeEdge.RIGHT]; }` },
    { code: `class Foo { id = nextId++; update() { this.id = nextId++; } }` },
    { code: `class Foo { count = signal(0); }` },
    { code: `class Foo { form = new FormGroup({}); }` },
    { code: `class Foo { readonly BASE = 2; value = this.BASE * 2; }` },
    // transform = utilFn in a @Pipe class is the mandated pattern (no-pipe-logic), not a class constant
    { code: `@Pipe({ name: 'myPipe' }) class MyPipe { transform = myUtil; }` },
    { code: `class Foo { private items = []; add(item) { this.items.push(item); } }` },
    { code: `class Foo { private cache = {}; add(key, value) { this.cache[key] = value; } }` },
    { code: `class Foo { protected activeId = null; }` },
  ],
  invalid: [
    {
      code: `@Component({ template: '<button (click)="toggle()">{{ isOpen }}</button>' }) class C { protected isOpen = false; }`,
      output: `@Component({ template: '<button (click)="toggle()">{{ isOpen }}</button>' }) class C { protected readonly isOpen = false; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo { #limit = 1; }`,
      output: `class Foo { readonly #limit = 1; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo extends Base { override limit = 1; }`,
      output: `class Foo extends Base { override readonly limit = 1; }`,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `class Foo { readonly #limit = 1; }`,
      errors: [{ messageId: 'shouldUseScreamingCase' }],
    },
    {
      code: `class Foo extends Base { override readonly limit = 1; }`,
      errors: [{ messageId: 'shouldUseScreamingCase' }],
    },
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
