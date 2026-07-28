# Changelog

## 1.0.0-next.16

### Minor Changes

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`19469c2`](https://github.com/ethlete-io/ethdk/commit/19469c21903217e05b974ac69773f222e63ae4e1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `no-effect-cleanup-return`: flags a cleanup function returned from `effect()` /
  `afterRenderEffect()`, which Angular ignores — so the teardown silently never runs. Auto-fixes the
  mechanical case to the `onCleanup` parameter; otherwise points at `inject(DestroyRef).onDestroy()`.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`3151b7a`](https://github.com/ethlete-io/ethdk/commit/3151b7a253d14e38e22e20d67bf0191f141c144e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `ethlete/no-template-literal-before-inline-template`, and restructure the files it flagged.

  The Angular VS Code extension decides **client-side** whether the cursor sits inside an inline `template:` before it forwards completion, hover, go-to-definition or signature-help to the language server. That check (`isNotTypescriptOrSupportedDecoratorField`) walks the file with a bare `ts.createScanner()` loop, which cannot re-scan `}` as `TemplateMiddle`/`TemplateTail` — that needs the parser's `reScanTemplateToken()`. So the first template literal containing a `${…}` substitution desynchronises both the token stream and the brace counter, the scanner never recognises `template` `:` again, and every template request below it is dropped. The language server answers those requests correctly; the editor just never asks, so the template silently has no IntelliSense at all.

  The new rule reproduces that scanner verbatim, so it reports exactly the templates the extension would abandon — no heuristic. Twenty inline templates across `components`, `cdk` and the playground were affected, all of them behind a fixture or helper that happened to use an interpolated template literal. Story fixtures moved into sibling `*-storybook.data.ts` files; spec fixtures and in-class helpers that must stay above their component (because a later `@Component` references the class in `imports`) were rewritten without the interpolation.

  No public API changed — the `components` and `cdk` bumps are story/spec restructuring plus moving `signalVisibilityChangeClasses` below `RichFilterHostComponent` in the same module.

## 1.0.0-next.15

### Minor Changes

- [`6f4b966`](https://github.com/ethlete-io/ethdk/commit/6f4b966c4dc0244b9dfc40978f42362fe9c89a58) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose the `recommendedSpec` flat config (relaxes `no-non-null-assertion` in `*.spec.ts`) as `ethlete.configs.recommendedSpec`.

## 1.0.0-next.14

### Patch Changes

- [`423b30b`](https://github.com/ethlete-io/ethdk/commit/423b30ba4f368d7cee8c464ebd89b5df20d3934c) Thanks [@TomTomB](https://github.com/TomTomB)! - The `static` class member ban now excepts `ngTemplateContextGuard`, which Angular's template type checker requires to be static.

- [`7ca77d4`](https://github.com/ethlete-io/ethdk/commit/7ca77d4a9e1dd3abad7237227c62643159719b74) Thanks [@TomTomB](https://github.com/TomTomB)! - `no-trivial-return-type`: self-referencing (recursive) functions keep their return type annotation — TypeScript cannot infer a return type that depends on itself (TS7023), so the fixer no longer strips it there.

## 1.0.0-next.13

### Minor Changes

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`5a43c83`](https://github.com/ethlete-io/ethdk/commit/5a43c8347a98a815562d1bb0f59bc0db1d765262) Thanks [@github-actions](https://github.com/apps/github-actions)! - Recommended config: the `@Injectable` ban now also flags Angular 22's `@Service` decorator — use `createProvider` / `createRootProvider` from `@ethlete/core` instead.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9be3738`](https://github.com/ethlete-io/ethdk/commit/9be3738e18ef1837841c79131127fa42406a3e92) Thanks [@github-actions](https://github.com/apps/github-actions)! - New template rule `ethlete/prefer-static-boolean-properties` (in `recommendedTemplate` as `warn`): flags property bindings of static booleans like `[isReadonly]="true"` and suggests the static-attribute form (`isReadonly` / `isReadonly="false"`). Suggestion-only, since the rewrite is only safe for inputs with a `booleanAttribute` transform.

## 1.0.0-next.12

### Minor Changes

- [`44adcac`](https://github.com/ethlete-io/ethdk/commit/44adcac94d7e0f56742e02901221c6e04da7df47) Thanks [@TomTomB](https://github.com/TomTomB)! - Add two component I/O naming rules:
  - `no-native-html-input-name` (error) — flags an `input()`/`model()` named after a global HTML attribute (`title`, `id`, `hidden`, `role`, `tabindex`, …), which collides with the attribute the host element carries natively.
  - `prefer-present-tense-output` (warn) — nudges `output()` names toward the present tense like native DOM events (`playerSelect`, not `playerSelected`).

  The `on`-prefix case is already covered by `@angular-eslint/no-output-on-prefix`, so no rule is added for it.

## 1.0.0-next.11

### Major Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`396bdfb`](https://github.com/ethlete-io/ethdk/commit/396bdfb50dc51d2de0156dd7b7cc0ae3b21dfe9b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Remove the `no-public-property` rule. It contradicted `template-member-accessibility`, which requires an explicit `public` modifier on surface members — the explicit-public style is the intended one. The rule was never part of the `recommended` config; if you enabled `ethlete/no-public-property` manually, drop it from your ESLint config.

## 0.1.0-next.10

### Minor Changes

- [`4e9f2b4`](https://github.com/ethlete-io/ethdk/commit/4e9f2b4d12335fafef192350aef8ffc584996a91) Thanks [@TomTomB](https://github.com/TomTomB)! - Make the OnPush change detection rules Angular-version aware. Since OnPush is the default from Angular 22, declaring it is now redundant:
  - Add `no-redundant-on-push-change-detection`, which flags and auto-fixes explicit `changeDetection: ChangeDetectionStrategy.OnPush` on `@Component`, and removes the now-unused `ChangeDetectionStrategy` import when it is no longer referenced. Active on Angular >= 22.
  - `require-on-push-change-detection` now only applies on Angular <= 21, where OnPush is opt-in.

  Both rules resolve the workspace's Angular major version automatically (overridable via `settings.ethlete.angularMajor`) and stay inert when they don't apply, so exactly one of them is ever active for a given Angular version.

## 0.1.0-next.9

### Patch Changes

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - `class-member-order`: recognize custom `injectXyz()` helper functions (not just the raw `inject()` call) as inject-group members, so they're required to be declared before inputs/outputs/queries/properties like other injected dependencies.

## 0.1.0-next.8

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 0.1.0-next.7

### Patch Changes

- [`7e8ac6b`](https://github.com/ethlete-io/ethdk/commit/7e8ac6bf18f580289c7c7966c6c33a2a7f077299) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix false positives in pipes

## 0.1.0-next.6

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 0.1.0-beta.5

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

## 0.1.0-next.4

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 0.1.0-next.3

### Patch Changes

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor lint edge cases

## 0.1.0-next.2

### Patch Changes

- [#2957](https://github.com/ethlete-io/ethdk/pull/2957) [`81173d4`](https://github.com/ethlete-io/ethdk/commit/81173d426d1a53ea2a7af0d16d6eb0fe4a16dbd9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add missing auto fixers

## 0.1.0-next.1

### Patch Changes

- [`6ec51b4`](https://github.com/ethlete-io/ethdk/commit/6ec51b49497ba53bf34ec0aabcf519957ba0e412) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix plugin not including js files

## 0.1.0-next.0

### Minor Changes

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`3f22771`](https://github.com/ethlete-io/ethdk/commit/3f22771bb3a339461ce8c70a48e573897579f3c4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add basic set of styleguide based rules

All notable changes to this project will be documented in this file.
