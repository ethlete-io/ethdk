# Core lib scan — open findings

Scan of `libs/core` from 2026-08-19. Fixed findings were removed on 2026-09-26 (git history has
them). Still open: 5 Medium, 22 Low, 18 spec-coverage items.

## signals

- Low: narration comments at `recipes/cursor-drag-scroll.ts:80,89,137`; duplicated comment at `element-children.ts:33-34` / `element-scroll-state.ts:77-78`. S
- Low: `breakpointTransformBase` exported and undocumented (`breakpoint-input.ts:56`). S
- Low: subscribe with a body at `deferred-loading.ts:61`, `recipes/scroll-restoration.ts:502`; rule still off (`eslint.config.mjs:93`). S
- Low: undocumented `canScroll` (`cursor-drag-scroll.ts:26`, missing from `signal-utils.md:173`) and `signalElementChildren`'s `mutations` (`element-children.ts:16`). S
- Spec: no spec/scenario for `animated-block-size.ts`; `element.ts` coercion matrix only covered indirectly. M

## overlay, animations, scrolling

- Low: `flip-animation.docs.mdx` and `animation-utils.docs.mdx` are 5-line stubs. S
- Low: comments at `overlay-runtime.ts:207-208`, `animation-utils.ts:19-21`, `scrollable.ts:4-5,24-26`; JSDoc on non-exported helpers at `overlay-position.ts:12-15`, `overlay-position-anchored.ts:142-145`. S
- Spec: `animated-lifecycle.directive.spec.ts` has 4 leave-path tests only — no enter path, interrupts, `skipNextEnter`, `force*State`, `AnimatedIfDirective`. M

## theming, providers

- Low: unreachable `&& value !== null` at `provide-color.directive.ts:106`. S
- Low: `surface-theming.docs.mdx:193` credits "The context tracker" with the elevation stack. S
- Low: `as any` at `auto-surface.directive.ts:151`; `settleWatcher` destroyed only once connected (`:141`). S
- Low: `@internal` on cross-package API (`provide-color.directive.ts:34,154,159`, `provide-surface.directive.ts:146,151`); core has no `stripInternal`. M, decision first
- Low: comments at `auto-surface.directive.ts:34-42,61-76,122-131`. S
- Spec: no spec for `labels.ts`, `style-manager.ts`, `renderer.ts`, `surface-theme.util.ts`, `color-palette.util.ts`, the color/surface interactive directives, `boundary-element.ts`, `user-consent.ts`. M

## utils, pipes, directives

- Spec: no zero-movement axis-lock case in `swipe.spec.ts`. S
- Spec: no tests for `math.ts`, `host-listener.ts`, `query-list-changes.ts`, `set-input-signal.ts`, `session-memory.ts`, `runtime-error.ts`. M
- Spec: no direct tests for `normalize-match-score`, `-game-result-type`, `-match-type`, `-match-participants`. S
- Spec: no spec for `drag-handle.directive.ts`, `resize-handles.component.ts`. M
- Spec: `object.spec.ts:51` (`'a.b.e[1'`) passes for an accidental reason. S

## seo, app-update, notifications, unsaved-changes

- Low: section-divider comments at `meta-binding.ts:59-133`. S
- Low: stores disagree on pre-existing tags — `meta-binding.ts:199-200` wipes them, `link-binding.ts:131` removes only its own; undocumented. M
- Low: stale `no-async-await` disable (`eslint.config.mjs:70-74`); `check`/`runCheck` still return Promises. S
- Low: `@internal` on exported `UnsavedChangesRegistration`, `runCheck`, `register` (`unsaved-changes-coordinator.ts:28,53,89`). S
- Low: natively dismissed SW notification leaves its `clickHandlers` entry (`notifications.ts:253`). S
- Spec: app-update poll pipeline (visibility, `minCheckInterval`) and `NavigationError` untested; specs use `pollInterval: 0` only. S
- Spec: unsaved-changes has no test for `compareFn` or the unsupported-source throw. S

## generator: migrate-to-v5

- Medium: `export { createProvider } from '@ethlete/cdk'` and namespace imports skipped silently (`create-provider.ts:57`). S
- Medium: `detectCssVariableUsage` walks `node_modules` (`viewport-service.ts:322-330`). S
- Medium: first-match `string.replace` edits (`router-state-service.ts:839,877,925,972,1023`, `viewport-service.ts:1655,1866,1896,1947,1987`). M
- Medium: no scope flag (`schema.json`); transforms emit no review warnings (only `removed-exports.ts` reports). M
- Low: dead code hidden by file-level eslint-disable (`router-state-service.ts:1,662,682`, `viewport-service.ts:1`). S
- Low: comments at `create-provider.ts:9,55,73,78…`, `router-state-service.ts:155,312,849`. S
- Low: `migration.ts:36` has no router-state bullet; `console.log` and `logger` mixed. S
- Spec: no regression cases for the High fixes (two components per file, local `RouterStateService`, two classes per file, `type`/aliased imports, name in a template comment). M
- Spec: `migration.spec.ts` tests only `skipFormat`; nothing asserts reported counts/log output. S
- Spec: no `node_modules` fixture, no byte-identical check on an unrelated file. S

## other generators, packaging

- Medium: `tailwind-4-color-theme` drops spreads of imported consts silently (`generator.ts:447-462`); `theming.md` doesn't document it. M
- Low: `//#region` dividers, "Step 1..9" narration (`tailwind-4-color-theme/generator.ts:78-157`), restatements (`:178,187,223`), wrong "Migration main" label (`:55`). S
- Low: `defaultThemes`/`regularThemes`/`mainThemes` reorder still there (`generator.ts:557-605`). S
- Low: `stories/changelog-page.mdx:3` names the import `Readme`. S
- Spec: surface generator lacks malformed swatch, shared tint const, inline theme literal cases. S
- Spec: color generator lacks imported spreads, inline literals, `.scss` output path cases. S
- Spec: `devtools-about` never tests a spec file next to the real config, or a re-run on a wired app. S
- Spec: `migration-scope.ts` has no spec. S

## Kept on purpose / do not re-open

- The animation directives' `BehaviorSubject`s. `state$` is a stream of transition events whose ~20 consumers need every state synchronously inside `.next()`; the signal version (`toObservable(state)` plus effects) dropped the middle state of a synchronous `entering→entered` / `leaving→left` jump and was reverted in `6296a5b41`.
- The `props/` module findings — `props/` was removed on 2026-09-23.
