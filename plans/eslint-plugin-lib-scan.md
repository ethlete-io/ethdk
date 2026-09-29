# eslint-plugin lib scan — open findings

Scan of `libs/eslint-plugin` from 2026-08-19. Fixed findings were removed on 2026-09-26 (git history
has them). All 23 Medium findings are done (740745cfd, 0e8f4306d, fdc275315, 2ff9e0dd3, 5070c1fac, 1115ebd01, b962944d7, d8a6c9352, 8f943a33c, b96cb14a9, e183dbc6b, d6e261816, 608346bb0, 9ce9b2b4c, 3d9bbb0e5, 562f182ac, 5d32f7e16, 10af4378d, 836c57050, 1dd03c288, 321ffa7e8, f4ba9f3c5, 64e382a80; the spread bail-out of `angular-decorator-property-order` is kept). Still open: 46 Low, 13 spec-coverage items. Paths are relative to
`libs/eslint-plugin/src/rules/` unless shown in full.

## ordering & naming

- Low: `guard-return-newline` accepts a comment line as the blank line. S
- Low: `no-empty-newlines-between-imports` inserts bare `\n` into CRLF files. S
- Low: `meta.docs.recommended` missing on 22 rule files (e.g. `guard-return-newline`, `require-form-submit`, `require-view-encapsulation-none`). S
- Low: `rules.md:120` marks `class-constant-property` 🔧 but `shouldUseScreamingCase` has no fixer. S
- Low: `no-leading-underscore-class-member` silent for parameter properties, `static`, `accessor`, `abstract`; `class-member-order` silent on `accessor`. M
- Low: comments at `no-screaming-case-local.js:72,77,80`, `guard-return-newline.js:40,43,48,51`. S
- Low: `configs/recommended.js:55` says "No \_ or # prefixes" but `:74,80` allow `_`. S
- Low: `class-constant-property.js:66` lacks a `!callee.computed` guard. S
- Spec: `class-member-order` never asserts `dependencyOrder`; no cycle or getter/setter tests; `class-member-order.spec.js:137-144` expects a stray blank line. S
- Spec: no underscore-member specs for parameter properties/static/abstract/`accessor`; none for `#private`/`override` in `class-constant-property`. S
- Spec: no single-line guard or `return <value>` spec in `guard-return-newline`; no `let`/`var`/`toObservable` spec in `require-dollar-suffix`; no trailing-comment spec for `angular-decorator-property-order`. S

## Angular metadata

- Low: `apps/docs/eslint/index.md:88` says "all but four" rules take options; `settings.ethlete.angularMajor` undocumented. S
- Low: Angular version probe resolves from the plugin's own path (`require-on-push-change-detection.js:31`, `no-redundant-on-push-change-detection.js:39`). M
- Low: `require-on-push-change-detection.js` / `require-view-encapsulation-none.js` duplicate ~200 lines of helpers (`:12-199`). M
- Low: import rebuild flattens a multi-line import and drops its comments. S
- Low: fix output not clean on its own (`template: '' , host: {…}}`; multi-line insert lacks trailing comma). S
- Low: comments in `no-legacy-angular-decorators.js:259-323`; six `// ──` dividers in `configs/recommended.js`. S
- Low: `[{ directive: Foo } as const]` skipped by `prefer-concise-angular-host-directives`; ``styles: [`a{}`] as string[]`` skipped by `prefer-concise-angular-style-metadata`. S
- Low: `no-empty-angular-metadata-arrays` reports `imports: []` on `@Directive`. S
- Spec: none for `accessor`/`abstract` in `no-legacy-angular-decorators`, `TSTemplateLiteralType`, or comment preservation in the import rebuild. S

## visibility, members & internals

- Low: `no-redundant-internal` accepts `// @internal` and `/** @internal */ #x`. S
- Low: `accessor`/`abstract` members invisible to `template-member-accessibility` and `no-unused-class-member`. M
- Low: `rules.md:119` omits that write-only members count as read and that `protected` is only checked on some decorators. S
- Low: comments in `no-member-alias.js:66,70,118,120,125`, `no-unused-class-member.js:142`. S
- Low: `getMemberName` ignores `node.computed` (`angular-member-visibility.js:211-216`). S
- Spec: `template-member-accessibility.spec.js` lacks getter/setter, `static`, `override`, `async`, `declare`, computed-key, `${}` cases; `no-redundant-internal.spec.js` lacks `// @internal`, `#private`, decorated cases. S

## import & API bans

- Low: `no-cdk-import` note is a lowercase fragment (`no-cdk-import.js:138`, spec `:56`, `rules.md:297`). S
- Low: migration-map cache never invalidates, caches a missing map as `null`, constant default key (`no-cdk-import.js:28-51`). S
- Low: prepare fixer inserts the injector member under the next member's leading comment. S
- Low: `.runInContext` counts as an injection context. S
- Low: `router.snapshot` maps to `injectRouterState()` (`no-angular-router-api.js:50`), but Angular 22's `Router` has no `snapshot`. S
- Low: `untracked(() => legacyGetUsers.prepare({}))` and an IIFE still reported. S
- Low: `// ──` dividers in `no-angular-router-api.js` (5), `no-window-location.js` (2). S
- Spec: `no-legacy-prepare-without-injector` lacks namespace/default `@angular/core` import, `creatorPattern`, `untracked`/IIFE, `runInContext` cases. S
- Spec: no prototype-key case (`no-cdk-import`), namespace case (`no-legacy-query-import`), `this.router.<prop>`/cross-scope case (`no-angular-router-api`), injected-`DOCUMENT` case, bare `location.*` case; `configs/recommended.spec.js` misses `no-legacy-prepare-without-injector`. S

## reactive & signals

- Low: comments at `no-readonly-signal.js:80,89,93`; two dividers in `prefer-rxjs-timer.js`. S
- Low: `no-rxjs-in-effect` doesn't cover `afterRenderEffect` or `linkedSignal`. S
- Low: `rules.md:149` omits `clear*`/`removeEventListener`; `:144` omits the `play` exemption; `:71` omits that `inject(X).method()` is allowed. S
- Low: `new (inject(Foo).Bar)()` reported by `no-inject-chain`. S
- Spec: 8 of 10 specs run without `tsParser`. S
- Spec: no negative spec for the `play` exemption, by-reference handler, member `setTimeout`; `configs/recommended.spec.js` checks only `no-async-await` of these rules. S

## DOM & platform

- Low: `myMock.notTheDefaultView.innerWidth` reported. S
- Low: shadowed `class MutationObserver` reported. S
- Low: aliased/subclassed observers missed (`no-native-observers`). S
- Low: bracket access escapes `no-direct-dom-manipulation` and `no-dom-query`. `no-dom-query` done in 9ce021f7b.
- Low: `isRendererReceiver` is a substring test. S
- Low: `no-dom-query` has no receiver check (`points.closest(target)`); `innerHTML`, `className`, `textContent`, `Object.assign(el.style, …)` not reported. M
- Low: `prefer-element-dimensions.js:32` header shows `rect.width` instead of `rect().width`. S
- Low: `<form method="DIALOG">` false positive in `require-form-submit`. S
- Low: `// ──` dividers in `no-direct-dom-manipulation`, `prefer-match-media`, `prefer-scroll-state`. S
- Spec: `prefer-viewport-size` lacks `defaultView`/`outerHeight`/non-window receiver; `prefer-element-dimensions` lacks other properties/nested functions; `no-direct-dom-manipulation` covers few methods; `prefer-match-media` lacks change listener/bare `matchMedia()`/double report. S
- Spec: none for observer aliases/subclasses, uppercase `method`, or `no-dom-query` negatives. S

## misc, config, packaging & docs

- Low: `no-impure-top-level-provider` passes destructuring wrapped in `satisfies` or `!`. S
- Low: `enforce-routing-view-naming` reports non-route object literals; substring test lets `items-viewer` pass. S
- Low: dead `recommendedTs.plugins: {}` (`configs/recommended.js:12`). S
- Low: `apps/docs/eslint/index.md:88` links to a missing `#no-legacy-prepare-without-injector` anchor. S
- Low: comments in `prefer-clone-equal.js`, `no-pipe-logic`, `enforce-routing-view-naming`. S
- Spec: no namespace/default/`require` lodash cases, no `satisfies` case, no default-export/block `.then`/non-route case, nothing pins the `no-trivial-return-type` false negative. S
- Spec: no test that every registered rule is in `recommended` or on an exclusion list (`configs/recommended.spec.js` covers 26). M

## Kept on purpose / do not re-open

- Telling an RxJS `.pipe`/`.subscribe`/signal `.set()` receiver from a Node stream, a store or another one-argument `set` needs type information the rules don't have (incl. the Node-stream `.pipe` case in `no-subscribe-in-pipe` and the store `.subscribe` false positive).
- `export *` and `import('…')` of a package where only some symbols are banned cannot name the symbol, so they stay unreported.
- `window` in `no-window-location` / `prefer-viewport-size`, shadowed `window`, and the name lists in `no-readonly-signal` / `class-constant-property` / `no-legacy-prepare-without-injector` match by name.
- The contract lookup's `extends`/`Pick` limit — harmless.
