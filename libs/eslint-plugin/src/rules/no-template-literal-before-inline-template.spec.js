// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-template-literal-before-inline-template');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('no-template-literal-before-inline-template', rule, {
  valid: [
    {
      name: 'no template literals at all',
      code: `
const LABEL = 'Hello';

@Component({
  selector: 'et-test',
  template: \`<p>{{ label }}</p>\`,
})
class Foo {}
`,
    },
    {
      name: 'template literal without interpolation',
      code: `
const LABEL = \`Hello\`;

@Component({
  selector: 'et-test',
  template: \`<p>{{ label }}</p>\`,
})
class Foo {}
`,
    },
    {
      name: 'interpolated literal below the component',
      code: `
@Component({
  selector: 'et-test',
  template: \`<p>{{ label }}</p>\`,
})
class Foo {}

const makeLabel = (i) => \`Item \${i}\`;
`,
    },
    {
      name: 'interpolated literal inside the component class, below its own template',
      code: `
@Component({
  selector: 'et-test',
  template: \`<p>{{ label() }}</p>\`,
})
class Foo {
  label = () => \`Item \${this.index}\`;
}
`,
    },
    {
      name: 'empty inline template is not a completion site',
      code: `
const makeLabel = (i) => \`Item \${i}\`;

@Component({
  selector: 'et-test',
  template: \`\`,
})
class Foo {}
`,
    },
    {
      name: 'non-Angular decorator',
      code: `
const makeLabel = (i) => \`Item \${i}\`;

@Injectable({
  template: \`<p>hi</p>\`,
})
class Foo {}
`,
    },
  ],
  invalid: [
    {
      name: 'interpolated literal above an inline template',
      code: `
const makeLabel = (i) => \`Item \${i}\`;

@Component({
  selector: 'et-test',
  template: \`<p>{{ label }}</p>\`,
})
class Foo {}
`,
      errors: [{ messageId: 'breaksLanguageService', data: { line: '2' } }],
    },
    {
      name: 'interpolated literal above a quoted inline template',
      code: `
const makeLabel = (i) => \`Item \${i}\`;

@Component({
  selector: 'et-test',
  template: '<p>{{ label }}</p>',
})
class Foo {}
`,
      errors: [{ messageId: 'breaksLanguageService' }],
    },
    {
      name: 'first component poisons every later component in the file',
      code: `
@Component({
  selector: 'et-first',
  template: \`<p>{{ first }}</p>\`,
})
class First {
  label = \`Item \${1}\`;
}

@Component({
  selector: 'et-second',
  template: \`<p>{{ second }}</p>\`,
})
class Second {}
`,
      errors: [{ messageId: 'breaksLanguageService', data: { line: '7' } }],
    },
    {
      name: 'directive with an inline template',
      code: `
const makeLabel = (i) => \`Item \${i}\`;

@Directive({
  selector: '[etTest]',
  template: \`<p>hi</p>\`,
})
class Foo {}
`,
      errors: [{ messageId: 'breaksLanguageService' }],
    },
  ],
});
