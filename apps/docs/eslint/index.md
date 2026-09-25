# @ethlete/eslint-plugin

Custom ESLint rules and shareable flat configs that enforce the Ethlete Angular styleguide - 62 custom rules covering signals vs RxJS usage, class member accessibility, Angular component metadata, templates, input/output naming, DOM/platform access, TypeScript style and migrating off the maintenance-mode packages. Most rules ship with an auto-fixer, so `eslint --fix` (or `nx lint --fix`) does the bulk of the work.

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

`recommended` is an array of four entries, also exported individually for granular composition:

| Config                 | Applies to     | Contents                                                                                                                                                  |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recommendedTs`        | `**/*.ts`      | All custom `ethlete/*` rules plus the baseline TypeScript/JavaScript rules below                                                                          |
| `recommendedAngularTs` | `**/*.ts`      | The `@angular-eslint/*` TypeScript rules below. Leave it out of a non-Angular (e.g. NestJS) project                                                       |
| `recommendedTemplate`  | `**/*.html`    | Angular template rules (`@angular-eslint/template/*`, `ethlete/prefer-static-boolean-properties`, `ethlete/require-form-submit`, `ethlete/no-csp-unsafe`) |
| `recommendedSpec`      | `**/*.spec.ts` | Relaxes non-null assertions, async test code, and DOM/platform access used by test fixtures and browser assertions                                        |

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
      ...ethlete.configs.recommendedAngularTs.rules,
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
`recommendedTs` sets severities for `@typescript-eslint/*` rules, and `recommendedAngularTs` and `recommendedTemplate` for `@angular-eslint/*` rules, but none of them register those plugins or parsers - your base config must (Nx's `flat/angular` / `flat/angular-template` presets do). A non-Angular project (NestJS, Node tooling) uses `recommendedTs` and `recommendedSpec` alone and needs no `@angular-eslint` plugin. Peer requirements: Angular and Angular ESLint >= 21, ESLint >= 9, TypeScript >= 5.9 and `@typescript-eslint/eslint-plugin >= 8`.
:::

## What `recommended` enforces beyond the custom rules

Besides the [custom `ethlete/*` rules](/eslint/rules), `recommendedTs` configures a baseline of built-in and third-party rules:

- **TypeScript**: no `any` (`@typescript-eslint/no-explicit-any`); `type` instead of `interface` (owned by the custom [`ethlete/consistent-type-definitions`](/eslint/rules#typescript-code-style), which leaves an interface inside `declare module` / `declare global` alone so a module augmentation keeps merging); strict unused-variable checking (`_`-prefixed args exempt).
- **Naming**: camelCase / PascalCase / UPPER_CASE via `@typescript-eslint/naming-convention` - no leading/trailing underscores on types and methods, `T`-prefixed generic parameters (`TValue`, never bare `T`).
- **Code style**: `const` by default, no `var`, one declaration per statement, `===` / `!==` only, max two function parameters.
- **Banned syntax** (`no-restricted-syntax`): `function` declarations/expressions, arrow-function class properties, `static` members (except `ngTemplateContextGuard`, which Angular's template type checker requires to be static), `#`-private members, constructor injection, legacy Angular lifecycle hooks (`ngOnChanges`, `ngAfterViewInit`, …), `@Injectable` and `@Service` (use `defineProvider` / `defineRootProvider` from `@ethlete/core`), route guards and resolvers, barrel (`index`) imports, and `on`-prefixed method names.
- **Restricted globals**: direct `document` / `window` access - use `inject(DOCUMENT)` or a dedicated injection token.
- **Angular outputs** (`recommendedAngularTs`): no `on` prefix (`@angular-eslint/no-output-on-prefix`), no native DOM event names (`@angular-eslint/no-output-native`).

`recommendedTemplate` adds five template rules: no `$any()` (`@angular-eslint/template/no-any`), prefer plain attributes over property bindings for static strings (`@angular-eslint/template/prefer-static-string-properties`, e.g. `etIcon="foo"` instead of `[etIcon]="'foo'"`), and the same for static booleans (the custom [`ethlete/prefer-static-boolean-properties`](/eslint/rules#angular-templates), e.g. `isReadonly` instead of `[isReadonly]="true"` - suggestion-only and never offered for native boolean properties or structural directives). It also adds [`ethlete/require-form-submit`](/eslint/rules#angular-templates), which requires every `<form>` to handle its own submission, and the template half of [`ethlete/no-csp-unsafe`](/eslint/rules#dom-platform-ethlete-core), which flags static `style="…"` attributes a strict CSP blocks.

The two [migration rules](/eslint/rules#legacy-packages-migration) - `no-cdk-import` and `no-legacy-query-import` - are in no config: enable them per project once an app is leaving `@ethlete/cdk` or the legacy query system behind.

## Fixing violations

Almost none of the custom rules take options - severity is the only knob for all but four ([`no-impure-top-level-provider`](/eslint/rules#no-impure-top-level-provider), [`no-legacy-prepare-without-injector`](/eslint/rules#no-legacy-prepare-without-injector) and the two [migration rules](/eslint/rules#legacy-packages-migration)) - and the recommended config sets almost everything to `error` (a handful of `@ethlete/core`-migration rules are `warn`; see the [rule reference](/eslint/rules)). Run lint with `--fix` first and only hand-fix what remains:

```bash
yarn nx lint <project> --fix
# or
yarn eslint --fix .
```
