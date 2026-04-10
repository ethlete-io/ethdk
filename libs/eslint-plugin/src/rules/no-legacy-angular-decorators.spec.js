// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-legacy-angular-decorators');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('no-legacy-angular-decorators', rule, {
  valid: [
    // Signal-based alternatives — no legacy decorators
    { code: `class Foo { value = input(); }` },
    { code: `class Foo { change = output(); }` },
    { code: `class Foo { btn = viewChild('btn'); }` },
    { code: `class Foo { items = viewChildren(ItemComponent); }` },
    { code: `class Foo { header = contentChild('header'); }` },
    { code: `class Foo { sections = contentChildren(SectionComponent); }` },
    // model() for two-way binding
    { code: `class Foo { value = model(); }` },
    // Class-level decorators (@Component, @Directive, @Pipe etc.) must not be flagged
    { code: `@Component({ selector: 'app-foo' }) class FooComponent {}` },
    { code: `@Directive({ selector: '[appFoo]' }) class FooDirective {}` },
    // Methods without @HostListener
    { code: `class Foo { onClick() {} }` },
    // An @Output() whose name ends in 'Change' but has NO matching @Input() is still
    // a plain output error, not a model() error — that case produces useOutput.
    // (Tested in invalid below.)
  ],

  invalid: [
    // ── @Input() → input() ──────────────────────────────────────────────────

    {
      code: `class Foo { @Input() value; }`,
      errors: [{ messageId: 'useInput' }],
    },
    {
      // @Input with config object
      code: `class Foo { @Input({ required: true }) label = ''; }`,
      errors: [{ messageId: 'useInput' }],
    },

    // ── @Output() → output() ────────────────────────────────────────────────

    {
      code: `class Foo { @Output() clicked = new EventEmitter(); }`,
      errors: [{ messageId: 'useOutput' }],
    },

    // ── @ViewChild / @ViewChildren ───────────────────────────────────────────

    {
      code: `class Foo { @ViewChild('btn') btn; }`,
      errors: [{ messageId: 'useViewChild' }],
    },
    {
      code: `class Foo { @ViewChildren(ItemCmp) items; }`,
      errors: [{ messageId: 'useViewChildren' }],
    },

    // ── @ContentChild / @ContentChildren ────────────────────────────────────

    {
      code: `class Foo { @ContentChild('header') header; }`,
      errors: [{ messageId: 'useContentChild' }],
    },
    {
      code: `class Foo { @ContentChildren(SectionCmp) sections; }`,
      errors: [{ messageId: 'useContentChildren' }],
    },

    // ── @HostBinding → host: {} ──────────────────────────────────────────────

    {
      // On a property definition
      code: `class Foo { @HostBinding('class.active') isActive = false; }`,
      errors: [{ messageId: 'useHostBinding' }],
    },
    {
      // On a getter method
      code: `class Foo { @HostBinding('class.active') get isActive() { return true; } }`,
      errors: [{ messageId: 'useHostBinding' }],
    },

    // ── @HostListener → host: {} ─────────────────────────────────────────────

    {
      code: `class Foo { @HostListener('click') onClick() {} }`,
      errors: [{ messageId: 'useHostListener' }],
    },
    {
      code: `class Foo { @HostListener('keydown.enter', ['$event']) onKeydown(e) {} }`,
      errors: [{ messageId: 'useHostListener' }],
    },

    // ── two-way binding pair → model() ───────────────────────────────────────

    {
      // @Input() x + @Output() xChange → both decorated nodes get useModel
      code: `class Foo { @Input() value = ''; @Output() valueChange = new EventEmitter(); }`,
      errors: [{ messageId: 'useModel' }, { messageId: 'useModel' }],
    },
    {
      code: `class Foo { @Input() status; @Output() statusChange = new EventEmitter(); }`,
      errors: [{ messageId: 'useModel' }, { messageId: 'useModel' }],
    },
    {
      // Output defined BEFORE the matching input — order must not matter
      code: `class Foo { @Output() nameChange = new EventEmitter(); @Input() name = ''; }`,
      errors: [{ messageId: 'useModel' }, { messageId: 'useModel' }],
    },

    // ── @Output() xChange with no matching @Input() → plain useOutput ────────

    {
      code: `class Foo { @Output() fooChange = new EventEmitter(); }`,
      errors: [{ messageId: 'useOutput' }],
    },

    // ── multiple legacy decorators in a single class ──────────────────────────

    {
      code: `class Foo { @Input() a; @Input() b; }`,
      errors: [{ messageId: 'useInput' }, { messageId: 'useInput' }],
    },
  ],
});
