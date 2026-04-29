// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./angular-decorator-property-order');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('angular-decorator-property-order', rule, {
  valid: [
    {
      code: `
@Component({
  selector: 'et-test',
  template: '<div></div>',
  styleUrl: './test.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FooComponent],
  providers: [provideFoo()],
  viewProviders: [provideBar()],
  animations: [trigger('show', [])],
  hostDirectives: [FooDirective],
  host: { class: 'et-test' },
  styles: ':host { display: block; }',
  preserveWhitespaces: false,
  standalone: false,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  jit: true,
  exportAs: 'etTest',
})
class TestComponent {}
`,
    },
    {
      code: `
@Directive({
  selector: '[etTest]',
  exportAs: 'etTest',
  providers: [provideFoo()],
  inputs: ['foo'],
  outputs: ['fooChange'],
  queries: { item: new ContentChild('item') },
  hostDirectives: [FooDirective],
  host: { class: 'et-test' },
  standalone: true,
  jit: true,
})
class TestDirective {}
`,
    },
    {
      code: `
@Component({
  selector: 'et-test',
  templateUrl: './test.html',
  animations: [trigger('foo', [])],
})
class TestComponent {}
`,
    },
    {
      code: `
@Component({
  selector: 'et-test',
  ...metadata,
})
class TestComponent {}
`,
    },
  ],
  invalid: [
    {
      code: `
@Component({
  host: { class: 'et-test' },
  selector: 'et-test',
  template: '<div></div>',
})
class TestComponent {}
`,
      output: `
@Component({
  selector: 'et-test',
  template: '<div></div>',
  host: { class: 'et-test' },
})
class TestComponent {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `
@Directive({
  host: { class: 'et-test' },
  selector: '[etTest]',
  exportAs: 'etTest',
})
class TestDirective {}
`,
      output: `
@Directive({
  selector: '[etTest]',
  exportAs: 'etTest',
  host: { class: 'et-test' },
})
class TestDirective {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `
@Component({
  selector: 'et-test',
  animations: [trigger('foo', [])],
  imports: [FooComponent],
  host: { class: 'et-test' },
})
class TestComponent {}
`,
      output: `
@Component({
  selector: 'et-test',
  imports: [FooComponent],
  animations: [trigger('foo', [])],
  host: { class: 'et-test' },
})
class TestComponent {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `
@Component({
  selector: 'et-test',
  standalone: false,
  host: { class: 'et-test' },
  styles: ':host { display: block; }',
})
class TestComponent {}
`,
      output: `
@Component({
  selector: 'et-test',
  host: { class: 'et-test' },
  styles: ':host { display: block; }',
  standalone: false,
})
class TestComponent {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `
@Directive({
  selector: '[etTest]',
  inputs: ['foo'],
  providers: [provideFoo()],
  host: { class: 'et-test' },
})
class TestDirective {}
`,
      output: `
@Directive({
  selector: '[etTest]',
  providers: [provideFoo()],
  inputs: ['foo'],
  host: { class: 'et-test' },
})
class TestDirective {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `
@Component({
  selector: 'et-test',
  // host bindings stay with host
  host: { class: 'et-test' },
  imports: [FooComponent],
})
class TestComponent {}
`,
      output: `
@Component({
  selector: 'et-test',
  imports: [FooComponent],
  // host bindings stay with host
  host: { class: 'et-test' },
})
class TestComponent {}
`,
      errors: [{ messageId: 'outOfOrder' }],
    },
    {
      code: `@Component({ host: {}, selector: 'et-test', template: '' }) class TestComponent {}`,
      output: `@Component({ selector: 'et-test', template: '', host: {} }) class TestComponent {}`,
      errors: [{ messageId: 'outOfOrder' }],
    },
  ],
});
