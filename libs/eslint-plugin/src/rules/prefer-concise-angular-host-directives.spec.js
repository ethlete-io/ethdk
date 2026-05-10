// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-concise-angular-host-directives');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('prefer-concise-angular-host-directives', rule, {
  valid: [
    {
      code: `
@Component({
  hostDirectives: [ColoredDirective],
})
class TestComponent {}
`,
    },
    {
      code: `
@Component({
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['theme'],
      outputs: ['themeChange'],
    },
  ],
})
class TestComponent {}
`,
    },
    {
      code: `
@Directive({
  hostDirectives: [{ directive: ProvideColorDirective, inputs: ['theme'] }],
})
class TestDirective {}
`,
    },
  ],
  invalid: [
    {
      code: `
@Component({
  hostDirectives: [
    {
      directive: ColoredDirective,
    },
  ],
})
class TestComponent {}
`,
      output: `
@Component({
  hostDirectives: [
    ColoredDirective,
  ],
})
class TestComponent {}
`,
      errors: [{ messageId: 'preferShorthand' }],
    },
    {
      code: `
@Component({
  hostDirectives: [{ outputs: ['themeChange'], directive: ProvideColorDirective, inputs: ['theme'] }],
})
class TestComponent {}
`,
      output: `
@Component({
  hostDirectives: [{ directive: ProvideColorDirective, inputs: ['theme'], outputs: ['themeChange'] }],
})
class TestComponent {}
`,
      errors: [{ messageId: 'hostDirectiveOrder' }],
    },
    {
      code: `
@Directive({
  hostDirectives: [
    {
      outputs: ['themeChange'],
      directive: ProvideColorDirective,
    },
  ],
})
class TestDirective {}
`,
      output: `
@Directive({
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      outputs: ['themeChange'],
    },
  ],
})
class TestDirective {}
`,
      errors: [{ messageId: 'hostDirectiveOrder' }],
    },
  ],
});
