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
  hostDirectives: [ColorThemedDirective],
})
class TestComponent {}
`,
    },
    {
      code: `
@Component({
  hostDirectives: [
    {
      directive: ProvideThemeDirective,
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
  hostDirectives: [{ directive: ProvideThemeDirective, inputs: ['theme'] }],
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
      directive: ColorThemedDirective,
    },
  ],
})
class TestComponent {}
`,
      output: `
@Component({
  hostDirectives: [
    ColorThemedDirective,
  ],
})
class TestComponent {}
`,
      errors: [{ messageId: 'preferShorthand' }],
    },
    {
      code: `
@Component({
  hostDirectives: [{ outputs: ['themeChange'], directive: ProvideThemeDirective, inputs: ['theme'] }],
})
class TestComponent {}
`,
      output: `
@Component({
  hostDirectives: [{ directive: ProvideThemeDirective, inputs: ['theme'], outputs: ['themeChange'] }],
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
      directive: ProvideThemeDirective,
    },
  ],
})
class TestDirective {}
`,
      output: `
@Directive({
  hostDirectives: [
    {
      directive: ProvideThemeDirective,
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
