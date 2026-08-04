# @ethlete/eslint-plugin

Custom ESLint rules and shareable flat configs that enforce the Ethlete Angular styleguide - 54 custom rules covering signals vs RxJS usage, class member accessibility, Angular component metadata, templates, input/output naming, DOM/platform access and TypeScript style. Most rules ship with an auto-fixer, so `eslint --fix` (or `nx lint --fix`) does the bulk of the work.

```bash
yarn add --dev @ethlete/eslint-plugin
```

The plugin is the automated enforcement of the written [styleguide](https://github.com/ethlete-io/ethdk/blob/main/docs/STYLEGUIDE.md); the rule reference lives on the [Rules](/eslint/rules) page.

## Usage

The package exports flat configs only (ESLint 9+). The simplest setup spreads the combined `recommended` array into your config:

```js
// eslint.config.mjs
import ethlete from '@ethlete/eslint-plugin';

export default [
  // ...your base config (parsers, Angular presets, etc.)
  ...ethlete.configs.recommended,
];
```

`recommended` is an array of three entries, also exported individually for granular composition:

| Config                | Applies to     | Contents                                                                                                       |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `recommendedTs`       | `**/*.ts`      | All custom `ethlete/*` rules plus the baseline TypeScript/JavaScript rules below                               |
| `recommendedTemplate` | `**/*.html`    | Angular template rules (`@angular-eslint/template/*` and `ethlete/prefer-static-boolean-properties`)           |
| `recommendedSpec`     | `**/*.spec.ts` | Turns off `@typescript-eslint/no-non-null-assertion` - non-null assertions are common and intentional in tests |

The `ethlete` plugin itself is pre-wired into the configs - you don't need a `plugins:` entry for it.

A granular setup (how this repo lints `libs/components`) spreads `recommendedTs` into its own block to add ignores and project-specific rules:

```js
// eslint.config.mjs
import ethlete from '@ethlete/eslint-plugin';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/generators/**'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      // project-specific overrides / additions
      '@angular-eslint/component-selector': [
        'error',
        { type: ['element', 'attribute'], prefix: 'et', style: 'kebab-case' },
      ],
    },
  },
  ethlete.configs.recommendedTemplate,
  ethlete.configs.recommendedSpec,
];
```

::: warning Bring your own base config
`recommendedTs` and `recommendedTemplate` set severities for `@typescript-eslint/*` and `@angular-eslint/*` rules but do **not** register those plugins or parsers - your base config must (Nx's `flat/angular` / `flat/angular-template` presets do). Peer requirements: `eslint >= 9`, `@typescript-eslint/eslint-plugin >= 8`, `@angular-eslint/eslint-plugin-template >= 21`.
:::

## What `recommended` enforces beyond the custom rules

Besides the [custom `ethlete/*` rules](/eslint/rules), `recommendedTs` configures a baseline of built-in and third-party rules:

- **TypeScript**: no `any` (`@typescript-eslint/no-explicit-any`); `type` instead of `interface`; strict unused-variable checking (`_`-prefixed args exempt).
- **Naming**: camelCase / PascalCase / UPPER_CASE via `@typescript-eslint/naming-convention` - no leading/trailing underscores on types and methods, `T`-prefixed generic parameters (`TValue`, never bare `T`).
- **Code style**: `const` by default, no `var`, one declaration per statement, `===` / `!==` only, max two function parameters.
- **Banned syntax** (`no-restricted-syntax`): `enum`, `function` declarations/expressions, arrow-function class properties, `async`/`await` (use RxJS), `static` members (except `ngTemplateContextGuard`, which Angular's template type checker requires to be static), `#`-private members, constructor injection, legacy Angular lifecycle hooks (`ngOnChanges`, `ngAfterViewInit`, …), `@Injectable` and `@Service` (use `defineProvider` / `defineRootProvider` from `@ethlete/core`), route guards and resolvers, barrel (`index`) imports, and `on`-prefixed method names.
- **Restricted globals**: direct `document` / `window` access - use `inject(DOCUMENT)` or a dedicated injection token.
- **Angular outputs**: no `on` prefix (`@angular-eslint/no-output-on-prefix`), no native DOM event names (`@angular-eslint/no-output-native`).

`recommendedTemplate` adds three template rules: no `$any()` (`@angular-eslint/template/no-any`), prefer plain attributes over property bindings for static strings (`@angular-eslint/template/prefer-static-string-properties`, e.g. `etIcon="foo"` instead of `[etIcon]="'foo'"`), and the same for static booleans (the custom [`ethlete/prefer-static-boolean-properties`](/eslint/rules#angular-templates), e.g. `isReadonly` instead of `[isReadonly]="true"` - suggestion-only, since it is only safe for inputs with a `booleanAttribute` transform).

## Fixing violations

Almost none of the custom rules take options - severity is the only knob for all but two ([`no-impure-top-level-provider`](/eslint/rules#no-impure-top-level-provider) and [`no-legacy-prepare-without-injector`](/eslint/rules#no-legacy-prepare-without-injector)) - and the recommended config sets almost everything to `error` (a handful of `@ethlete/core`-migration rules are `warn`; see the [rule reference](/eslint/rules)). Run lint with `--fix` first and only hand-fix what remains:

```bash
yarn nx lint <project> --fix
# or
yarn eslint --fix .
```
