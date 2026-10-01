# eslint-plugin lib scan — open findings

Scan of `libs/eslint-plugin` from 2026-08-19. Everything that needed no decision is done (git history has
it). What remains needs a design call from Tom. Paths are relative to `libs/eslint-plugin/src/rules/`.

## import & API bans

- Spec: no injected-`DOCUMENT` case for `no-window-location` (`inject(DOCUMENT).location.href` is not reported; needs a design call). S

## reactive & signals

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
- `no-legacy-prepare-without-injector` treating `x.runInContext(cb)` as an injection context is right: `EnvironmentInjector.runInContext` still ships in Angular 22 (deprecated) and this repo's scenarios use it.
