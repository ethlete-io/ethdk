// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-redundant-internal');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-redundant-internal', rule, {
  valid: [
    {
      code: `class C {
  private service = inject(Service);
}`,
    },
    {
      code: `class C {
  /** @internal */
  registerControl(control) {
    this.control.set(control);
  }
}`,
    },
    {
      code: `class C {
  protected service = inject(Service);
}`,
    },
    {
      code: `class C {
  public service = inject(Service);
}`,
    },
    {
      code: `class C {
  /** @internal */
  public service = inject(Service);
}`,
    },
  ],
  invalid: [
    {
      code: `class C {
  /** @internal */
  private service = inject(Service);
}`,
      output: `class C {
  private service = inject(Service);
}`,
      errors: [
        { messageId: 'redundantInternal', data: { accessibility: 'private', kind: 'property', name: 'service' } },
      ],
    },
    {
      code: `class C {
  /** @internal */
  protected sync() {
    return true;
  }
}`,
      output: `class C {
  protected sync() {
    return true;
  }
}`,
      errors: [{ messageId: 'redundantInternal', data: { accessibility: 'protected', kind: 'method', name: 'sync' } }],
    },
  ],
});
