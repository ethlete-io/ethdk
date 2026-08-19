// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('./require-form-submit');

const tester = new RuleTester({
  languageOptions: {
    parser: /** @type {any} */ (templateParser),
  },
});

tester.run('require-form-submit', rule, {
  valid: [
    {
      code: `<form (ngSubmit)="save()"><button type="submit">Save</button></form>`,
      filename: 'test.html',
    },
    {
      code: `<form (submit)="save($event)"></form>`,
      filename: 'test.html',
    },
    // Signal forms: the directive on the form is what submits it
    {
      code: `<form [etForm]="form"><button type="submit">Save</button></form>`,
      filename: 'test.html',
    },
    {
      code: `<form [formRoot]="form"></form>`,
      filename: 'test.html',
    },
    // Native submission, handled by the platform rather than by a handler
    {
      code: `<form action="/search"></form>`,
      filename: 'test.html',
    },
    {
      code: `<form [action]="endpoint()"></form>`,
      filename: 'test.html',
    },
    {
      code: `<form ngNoForm></form>`,
      filename: 'test.html',
    },
    {
      code: `<form method="dialog"></form>`,
      filename: 'test.html',
    },
    // Associated by id, so it needs no ancestor
    {
      code: `<button type="submit" form="edit-user">Save</button>`,
      filename: 'test.html',
    },
    {
      code: `<button type="submit" [form]="formId()">Save</button>`,
      filename: 'test.html',
    },
    // Nested arbitrarily deep inside the form, including through blocks and other components
    {
      code: `<form (ngSubmit)="save()">@if (ready()) {<et-card><button type="submit">Save</button></et-card>}</form>`,
      filename: 'test.html',
    },
    {
      code: `<form (ngSubmit)="save()"><input type="submit" value="Save" /></form>`,
      filename: 'test.html',
    },
    // Not a submit control
    {
      code: `<button type="button" (click)="save()">Save</button>`,
      filename: 'test.html',
    },
    // A bound type cannot be resolved statically, so it is left alone
    {
      code: `<button [type]="isSubmit() ? 'submit' : 'button'">Save</button>`,
      filename: 'test.html',
    },
    {
      code: `<button type="submit">Save</button>`,
      filename: 'test.html',
    },
    {
      code: `<ng-template #actions><button type="submit">Save</button></ng-template>`,
      filename: 'test.html',
    },
  ],
  invalid: [
    {
      code: `<form [formGroup]="form"></form>`,
      filename: 'test.html',
      errors: [{ messageId: 'missingSubmitHandler' }],
    },
    {
      code: `<form><button type="submit">Save</button></form>`,
      filename: 'test.html',
      errors: [{ messageId: 'missingSubmitHandler' }],
    },
  ],
});
