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

tester.run('template-member-accessibility', rule, {
  valid: [
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
  ],
  invalid: [
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
          value = signal(false);
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
  ],
});
