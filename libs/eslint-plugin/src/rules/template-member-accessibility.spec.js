// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./template-member-accessibility');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const tempFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'template-member-accessibility-'));
const externalTemplatePath = path.join(tempFixtureRoot, 'fixture.component.html');
const externalComponentPath = path.join(tempFixtureRoot, 'fixture.component.ts');
const externalContractPath = path.join(tempFixtureRoot, 'fixture.contract.ts');

fs.writeFileSync(externalTemplatePath, '<span>{{ label() }}</span>', 'utf8');
fs.writeFileSync(externalContractPath, ['export type PublicApi = {', '  activate(): void;', '};'].join('\n'), 'utf8');

/** @type {import('eslint').RuleTester.InvalidTestCase[]} */
const invalid = [
  {
    code: `@Component({ template: '{{ x() }}' }) class C { accessor x = 1; }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public accessor x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) abstract class C { abstract x: number; }`,
    output: `@Component({ template: '{{ x() }}' }) abstract class C { public abstract x: number; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C { get x() { return 1; } }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public get x() { return 1; } }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C { set x(v) {} }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public set x(v) {} }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C { static x = 1; }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public static x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C extends B { override x = 1; }`,
    output: `@Component({ template: '{{ x() }}' }) class C extends B { public override x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C { async x() {} }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public async x() {} }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x() }}' }) class C { declare x: number; }`,
    output: `@Component({ template: '{{ x() }}' }) class C { public declare x: number; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: '@Component({ template: `{{ ${a}() }}` }) class C { x = 1; }',
    output: '@Component({ template: `{{ ${a}() }}` }) class C { public x = 1; }',
    errors: [{ messageId: 'shouldBeExplicitPublic' }],
  },
  {
    code: `@Component({ template: '' }) class C { accessor x = 1; }`,
    output: `@Component({ template: '' }) class C { public accessor x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicitPublic' }],
  },
  {
    code: `import { Component } from '@angular/core';
import { inject } from 'some-other-lib';
@Component({ template: '{{ store.value }}' }) class C { store = inject(Store); }`,
    output: `import { Component } from '@angular/core';
import { inject } from 'some-other-lib';
@Component({ template: '{{ store.value }}' }) class C { public store = inject(Store); }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `import { Component as Cmp } from '@angular/core';
@Cmp({ template: '{{ themeClass() }}' }) class C { themeClass = computed(() => 'x'); }`,
    output: `import { Component as Cmp } from '@angular/core';
@Cmp({ template: '{{ themeClass() }}' }) class C { public themeClass = computed(() => 'x'); }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          themeClass = computed(() => 'x');
        }
      `,
    output: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          public themeClass = computed(() => 'x');
        }
      `,
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'themeClass' } }],
  },
  {
    code: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          private themeClass = computed(() => 'x');
        }
      `,
    output: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          public themeClass = computed(() => 'x');
        }
      `,
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'themeClass' } }],
  },
  {
    code: `
        @Directive({
          host: {
            '[attr.aria-label]': 'label()'
          },
        })
        class C {
          label() {
            return 'x';
          }
        }
      `,
    output: `
        @Directive({
          host: {
            '[attr.aria-label]': 'label()'
          },
        })
        class C {
          public label() {
            return 'x';
          }
        }
      `,
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'label' } }],
  },
  {
    code: `
        @Component({ template: '' })
        class C {
          value = signal(false);
        }
      `,
    output: `
        @Component({ template: '' })
        class C {
          public value = signal(false);
        }
      `,
    errors: [{ messageId: 'shouldBeExplicitPublic', data: { name: 'value' } }],
  },
  {
    code: `
        @Component({ template: '' })
        class C {
          /** @internal */
          value = signal(false);
        }
      `,
    output: `
        @Component({ template: '' })
        class C {
          /** @internal */
          public value = signal(false);
        }
      `,
    errors: [{ messageId: 'shouldBeExplicitPublic', data: { name: 'value' } }],
  },
  {
    code: `
        @Component({ template: '' })
        class C {
          protected value = signal(false);
        }
      `,
    output: `
        @Component({ template: '' })
        class C {
          public value = signal(false);
        }
      `,
    errors: [{ messageId: 'shouldNotBeProtected', data: { name: 'value' } }],
  },
  {
    code: [
      '@Component({',
      "  templateUrl: './fixture.component.html'",
      '})',
      'class C {',
      '  label() {',
      "    return 'x';",
      '  }',
      '}',
    ].join('\n'),
    filename: externalComponentPath,
    output: [
      '@Component({',
      "  templateUrl: './fixture.component.html'",
      '})',
      'class C {',
      '  public label() {',
      "    return 'x';",
      '  }',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'label' } }],
  },
  {
    code: [
      "import { PublicApi } from './fixture.contract';",
      '@Directive({})',
      'class C implements PublicApi {',
      '  activate() {}',
      '}',
    ].join('\n'),
    filename: externalComponentPath,
    output: [
      "import { PublicApi } from './fixture.contract';",
      '@Directive({})',
      'class C implements PublicApi {',
      '  public activate() {}',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'shouldBePublic', data: { name: 'activate' } }],
  },
  {
    code: `@Component({ template: '{{ value }}' }) class C { private readonly value = 1; }`,
    output: `@Component({ template: '{{ value }}' }) class C { public readonly value = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'value' } }],
  },
  {
    code: `@Directive({ host: { '(click)': 'activate()' } }) class C { @HostListener('focus') private activate() {} }`,
    output: `@Directive({ host: { '(click)': 'activate()' } }) class C { @HostListener('focus') public activate() {} }`,
    errors: [{ messageId: 'shouldBeExplicit', data: { name: 'activate' } }],
  },
  {
    code: [
      "import { PublicApi } from './fixture.contract';",
      '@Directive({})',
      'class C implements PublicApi {',
      '  protected activate() {}',
      '}',
    ].join('\n'),
    filename: externalComponentPath,
    output: [
      "import { PublicApi } from './fixture.contract';",
      '@Directive({})',
      'class C implements PublicApi {',
      '  public activate() {}',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'shouldBePublic', data: { name: 'activate' } }],
  },
  {
    code: `@Component({ template: '' }) class C { protected /* kept */ value = 1; }`,
    output: `@Component({ template: '' }) class C { public /* kept */ value = 1; }`,
    errors: [{ messageId: 'shouldNotBeProtected' }],
  },
  {
    code: `@Component({ template: '' }) class C { @Input() protected value = 1; }`,
    output: `@Component({ template: '' }) class C { @Input() public value = 1; }`,
    errors: [{ messageId: 'shouldNotBeProtected' }],
  },
  {
    code: `@Component({ template: '' }) class C { protected static value = 1; }`,
    output: `@Component({ template: '' }) class C { public static value = 1; }`,
    errors: [{ messageId: 'shouldNotBeProtected' }],
  },
  {
    code: `@Component({ template: '' }) class C { declare protected value: number; }`,
    output: `@Component({ template: '' }) class C { declare public value: number; }`,
    errors: [{ messageId: 'shouldNotBeProtected' }],
  },
  {
    code: `@Component({ template: '' }) class C { protected get x() { return 1; } protected set x(v) {} }`,
    output: `@Component({ template: '' }) class C { public get x() { return 1; } public set x(v) {} }`,
    errors: [{ messageId: 'shouldNotBeProtected' }, { messageId: 'shouldNotBeProtected' }],
  },
  {
    code: `@Component({ template: '' }) class C { protected protected() {} }`,
    output: `@Component({ template: '' }) class C { public protected() {} }`,
    errors: [{ messageId: 'shouldNotBeProtected', data: { name: 'protected' } }],
  },
  {
    code: `@Component({ template: '' }) class C { protected x(a: string): void; protected x(a: number): void; protected x(a: unknown) {} }`,
    output: `@Component({ template: '' }) class C { public x(a: string): void; public x(a: number): void; public x(a: unknown) {} }`,
    errors: [
      { messageId: 'shouldNotBeProtected' },
      { messageId: 'shouldNotBeProtected' },
      { messageId: 'shouldNotBeProtected' },
    ],
  },
  {
    code: `@Component({ template: '{{ x(1) }}' }) class C { x(a: string): void; x(a: number): void; x(a: unknown) {} }`,
    output: `@Component({ template: '{{ x(1) }}' }) class C { public x(a: string): void; public x(a: number): void; public x(a: unknown) {} }`,
    errors: [{ messageId: 'shouldBeExplicit' }, { messageId: 'shouldBeExplicit' }, { messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ value() }}' }) class C { readonly value = input<string>(); }`,
    output: `@Component({ template: '{{ value() }}' }) class C { public readonly value = input<string>(); }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '' }) class C { readonly value = input.required<string>({ alias: 'protected' }); }`,
    output: `@Component({ template: '' }) class C { public readonly value = input.required<string>({ alias: 'protected' }); }`,
    errors: [{ messageId: 'shouldBeExplicitPublic' }],
  },
  {
    code: `@Component({ template: '{{ x }}' }) class C { @Input() @Other({ a: 1 }) private x = 1; }`,
    output: `@Component({ template: '{{ x }}' }) class C { @Input() @Other({ a: 1 }) public x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x }}' }) class C {\n  @Input()\n  set x(v: number) {}\n  get x() { return 1; }\n}`,
    output: `@Component({ template: '{{ x }}' }) class C {\n  @Input()\n  public set x(v: number) {}\n  public get x() { return 1; }\n}`,
    errors: [{ messageId: 'shouldBeExplicit' }, { messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x }}' }) class C { private static readonly x = 1; }`,
    output: `@Component({ template: '{{ x }}' }) class C { public static readonly x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
  {
    code: `@Component({ template: '{{ x }}' }) class C extends B { private override readonly x = 1; }`,
    output: `@Component({ template: '{{ x }}' }) class C extends B { public override readonly x = 1; }`,
    errors: [{ messageId: 'shouldBeExplicit' }],
  },
];

/**
 * @param {(string | import('eslint').RuleTester.ValidTestCase)[]} cases
 */
const uniqueCases = (cases) => [
  ...new Map(
    cases.map((testCase) => {
      const normalized = typeof testCase === 'string' ? { code: testCase } : testCase;
      return [`${normalized.filename ?? ''}\0${normalized.code}`, normalized];
    }),
  ).values(),
];

tester.run('template-member-accessibility', rule, {
  valid: uniqueCases([
    `@Directive({}) abstract class C { protected abstract x: number; }`,
    `@Directive({}) abstract class C { protected abstract x(): void; }`,
    `@Directive({}) abstract class BaseDirective { protected label = 'x'; }`,
    {
      code: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          [themeClass]() {}
        }
      `,
    },
    {
      code: `import { Component } from 'some-other-lib';
@Component({ template: '{{ themeClass() }}' }) class C { themeClass = computed(() => 'x'); }`,
    },
    {
      code: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          protected themeClass = computed(() => 'x');
        }
      `,
    },
    {
      code: `
        @Component({
          template: '{{ themeClass() }}',
        })
        class C {
          public themeClass = computed(() => 'x');
        }
      `,
    },
    {
      code: `
        @Directive({
          host: {
            '[attr.aria-label]': 'label()'
          },
        })
        class C {
          protected label() {
            return 'x';
          }
        }
      `,
    },
    {
      code: `
        @Component({ template: '' })
        class C {
          public value = signal(false);
        }
      `,
    },
    {
      code: `class C { protected value = signal(false); }`,
    },
    {
      code: `
        @Component({ template: '{{ service.value() }}' })
        class C {
          public service = inject(Service);
        }
      `,
    },
    {
      code: [
        "import { PublicApi } from './fixture.contract';",
        '@Directive({})',
        'class C implements PublicApi {',
        '  public activate() {}',
        '}',
      ].join('\n'),
      filename: externalComponentPath,
    },
    ...invalid.map(({ output, filename }) => ({
      code: /** @type {string} */ (output),
      ...(filename ? { filename } : {}),
    })),
  ]),
  invalid,
});
