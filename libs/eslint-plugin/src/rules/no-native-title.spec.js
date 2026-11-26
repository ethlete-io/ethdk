// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('./no-native-title');

const tester = new RuleTester({
  languageOptions: {
    parser: /** @type {any} */ (templateParser),
  },
});

const filename = 'test.html';

tester.run('no-native-title', rule, {
  valid: [
    { code: `<button etTooltip="Save">Save</button>`, filename },
    { code: `<et-card title="Heading"></et-card>`, filename },
    { code: `<et-card [title]="heading()"></et-card>`, filename },
    { code: `<svg><title>Icon</title></svg>`, filename },
    { code: `<button [attr.aria-label]="label()"></button>`, filename },
  ],
  invalid: [
    { code: `<button title="Save">Save</button>`, filename, errors: [{ messageId: 'nativeTitle' }] },
    { code: `<span [title]="label()"></span>`, filename, errors: [{ messageId: 'nativeTitle' }] },
    { code: `<span [attr.title]="label()"></span>`, filename, errors: [{ messageId: 'nativeTitle' }] },
    { code: `<et-card [attr.title]="label()"></et-card>`, filename, errors: [{ messageId: 'nativeTitle' }] },
    {
      code: `<a title="One"></a><a [title]="two"></a>`,
      filename,
      errors: [{ messageId: 'nativeTitle' }, { messageId: 'nativeTitle' }],
    },
  ],
});
