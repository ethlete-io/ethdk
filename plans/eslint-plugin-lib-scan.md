# eslint-plugin lib scan — open findings

Scan of `libs/eslint-plugin` from 2026-08-19. Fixed findings were removed on 2026-09-26 (git history
has them). All 23 Medium findings are done (740745cfd, 0e8f4306d, fdc275315, 2ff9e0dd3, 5070c1fac, 1115ebd01, b962944d7, d8a6c9352, 8f943a33c, b96cb14a9, e183dbc6b, d6e261816, 608346bb0, 9ce9b2b4c, 3d9bbb0e5, 562f182ac, 5d32f7e16, 10af4378d, 836c57050, 1dd03c288, 321ffa7e8, f4ba9f3c5, 64e382a80; the spread bail-out of `angular-decorator-property-order` is kept). Still open: 6 Low, 4 spec-coverage items. Paths are relative to
`libs/eslint-plugin/src/rules/` unless shown in full.

## ordering & naming

- Spec: `class-member-order.spec.js:137-144` expects a stray blank line (fixer output; the segment split keeps the moved member's leading newline). S

## Angular metadata

- Low: fix output not clean on its own (`template: '' , host: {…}}`; multi-line insert lacks trailing comma). S

## visibility, members & internals

## import & API bans

- Low: `.runInContext` counts as an injection context. S
- Spec: `no-legacy-prepare-without-injector` lacks a `runInContext` case (waits on the `.runInContext` line above). S
- Spec: no injected-`DOCUMENT` case for `no-window-location` (`inject(DOCUMENT).location.href` is not reported; needs a design call). S

## reactive & signals

- Low: `new (inject(Foo).Bar)()` reported by `no-inject-chain`. S
- Low: `subscribe(this.handle)` (a member reference, no inline body) is reported by `no-subscribe-with-body` (needs a design call). S

## DOM & platform

- Low: `no-dom-query` has no receiver check (`points.closest(target)`); `innerHTML`, `className`, `textContent` assignments not reported (needs a design call: without types both false-positive on non-DOM objects). M

## misc, config, packaging & docs

- Low: `enforce-routing-view-naming` reports non-route object literals (needs a design call: no type info to tell a route). S
- Spec: `enforce-routing-view-naming` has no default-export or non-route case (both would pin a questionable report; needs a design call). S

## Kept on purpose / do not re-open

- Telling an RxJS `.pipe`/`.subscribe`/signal `.set()` receiver from a Node stream, a store or another one-argument `set` needs type information the rules don't have (incl. the Node-stream `.pipe` case in `no-subscribe-in-pipe` and the store `.subscribe` false positive).
- `export *` and `import('…')` of a package where only some symbols are banned cannot name the symbol, so they stay unreported.
- `window` in `no-window-location` / `prefer-viewport-size`, shadowed `window`, and the name lists in `no-readonly-signal` / `class-constant-property` / `no-legacy-prepare-without-injector` match by name.
- The contract lookup's `extends`/`Pick` limit — harmless.
