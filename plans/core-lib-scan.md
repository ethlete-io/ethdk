# Core lib scan — open findings

Scan of `libs/core` from 2026-08-19. Fixed findings were removed on 2026-09-26 (git history has
them). Still open: 14 spec-coverage items. The Medium and Low lines were fixed on 2026-09-29.

## signals

- Spec: no spec/scenario for `animated-block-size.ts`; `element.ts` coercion matrix only covered indirectly. M

## overlay, animations, scrolling

- Spec: `animated-lifecycle.directive.spec.ts` has 4 leave-path tests only — no enter path, interrupts, `skipNextEnter`, `force*State`, `AnimatedIfDirective`. M

## theming, providers

- Spec: no spec for `labels.ts`, `style-manager.ts`, `renderer.ts`, `surface-theme.util.ts`, `color-palette.util.ts`, the color/surface interactive directives, `boundary-element.ts`, `user-consent.ts`. M

## utils, pipes, directives

- Spec: no zero-movement axis-lock case in `swipe.spec.ts`. S
- Spec: no tests for `math.ts`, `host-listener.ts`, `query-list-changes.ts`, `set-input-signal.ts`, `session-memory.ts`, `runtime-error.ts`. M
- Spec: no direct tests for `normalize-match-score`, `-game-result-type`, `-match-type`, `-match-participants`. S
- Spec: no spec for `resize-handles.component.ts` (`drag-handle.directive.ts` runs in `drag-handle.scenario.spec.ts`). S
- Spec: `object.spec.ts:51` (`'a.b.e[1'`) passes for an accidental reason. S

## seo, app-update, notifications, unsaved-changes

- Spec: unsaved-changes has no test for `compareFn` or the unsupported-source throw. S

## generator: migrate-to-v5

- Spec: no regression cases for the High fixes (two components per file, local `RouterStateService`, two classes per file, `type`/aliased imports, name in a template comment). M

## other generators, packaging

- Spec: surface generator lacks malformed swatch, shared tint const, inline theme literal cases. S
- Spec: color generator lacks inline literals, `.scss` output path cases. S
- Spec: `devtools-about` never tests a spec file next to the real config, or a re-run on a wired app. S
- Spec: `migration-scope.ts` has no spec. S

## Kept on purpose / do not re-open

- `settleWatcher` in `auto-surface.directive.ts` stays alive until the element is connected: windowed lists mount it in an off-pane container first.
- unsaved-changes `runCheck` still returns a Promise; `canDeactivate` consumes it.

- The animation directives' `BehaviorSubject`s. `state$` is a stream of transition events whose ~20 consumers need every state synchronously inside `.next()`; the signal version (`toObservable(state)` plus effects) dropped the middle state of a synchronous `entering→entered` / `leaving→left` jump and was reverted in `6296a5b41`.
- The `props/` module findings — `props/` was removed on 2026-09-23.
