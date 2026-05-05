// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-leading-underscore-class-member');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('no-leading-underscore-class-member', rule, {
  valid: [
    {
      code: `class Foo { private document = inject(DOCUMENT); read() { return this.document; } }`,
    },
  ],
  invalid: [
    {
      code: `class Foo { private _document = inject(DOCUMENT); read() { return this._document; } }`,
      output: `class Foo { private document = inject(DOCUMENT); read() { return this.document; } }`,
      errors: [{ messageId: 'noLeadingUnderscore', data: { oldName: '_document', newName: 'document' } }],
    },
    {
      code: `class Foo { private _load() { return 1; } run() { return this._load(); } }`,
      output: `class Foo { private load() { return 1; } run() { return this.load(); } }`,
      errors: [{ messageId: 'noLeadingUnderscore', data: { oldName: '_load', newName: 'load' } }],
    },
    {
      code: `class Foo { private _document = inject(DOCUMENT); private document = inject(DOCUMENT); }`,
      errors: [{ messageId: 'noLeadingUnderscore', data: { oldName: '_document', newName: 'document' } }],
    },
    {
      code: `class Foo { protected _document = inject(DOCUMENT); read() { return this._document; } }`,
      errors: [{ messageId: 'noLeadingUnderscore', data: { oldName: '_document', newName: 'document' } }],
    },
    {
      code: `class Foo { get value() { return this._value; } set value(value) { this._value = value; } private _value = 0; }`,
      errors: [{ messageId: 'noLeadingUnderscore', data: { oldName: '_value', newName: 'value' } }],
    },
    {
      code: `class Foo { protected _strokeDashOffset = 0; }`,
      errors: [
        { messageId: 'noLeadingUnderscore', data: { oldName: '_strokeDashOffset', newName: 'strokeDashOffset' } },
      ],
    },
  ],
});
