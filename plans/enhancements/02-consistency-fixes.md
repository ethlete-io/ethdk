# 02 — Consistency fixes (bug-like)

Small, independent fixes where half the codebase does it right and the other
half doesn't. Each item is its own commit-sized change; they can ship together
as one PR.

## 1. RTL drag-to-dismiss direction

`left-sheet.strategy.ts:14-16` hardcodes `dragToDismiss: { direction: 'to-left' }`
(right sheet mirrors) while positioning is logical (`horizontal: 'start'/'end'`).
In RTL the sheet renders on the opposite physical edge but the gesture doesn't
flip.

Fix: resolve direction at gesture setup from the container's computed
`direction`. Either accept logical values (`'to-inline-start'/'to-inline-end'`)
in `OverlayDragToDismissConfig` and map to physical at runtime, or keep the
physical API and have the left/right sheet strategies resolve
`getComputedStyle(...).direction` — slider already established the runtime
pattern (`slider-engine.ts:60-67`). Prefer the logical-value API: strategies
declare intent once, and consumer configs stay RTL-correct by default. Keep
physical values working (they mean what they say).

If `01-touch-gesture-overhaul.md` is being implemented, land this inside its
Phase 2 (same file).

## 2. Notification stack physical CSS

`notification-stack.component.css` implements `data-position='bottom-start'`
etc. with literal `left`/`right`. Replace with `inset-inline-start/end` so the
logically-named API actually flips in RTL. Verify the FLIP stack animation
still measures correctly under `dir="rtl"` (storybook story with `dir` toggle).

## 3. Reduced-motion gating for JS animations

Same utilities, inconsistent gating:

- `tabs/headless/tab-bar-underline.directive.ts` and
  `forms/selection-list/segmented-button-group/segmented-button.component.ts`
  run `createFlipAnimation(Group)` ungated (grid/carousel/dropzone gate it).
- All PiP animation paths ungated: `stream/pip/headless/internals/pip-animation.ts`
  (7 `.animate()` calls), `stream/stream-manager.ts` move-to-window,
  `pip-chrome-animations.ts`.

Fix at the source: make `createFlipAnimation`/`createFlipAnimationGroup`
(core `animations/flip-animation.ts`) check `prefers-reduced-motion`
internally (matchMedia — these may run outside injection context; verify) and
skip to end state, with an opt-out flag for the rare essential-motion case.
Remove now-redundant caller gates or leave them (harmless). Gate the PiP
`.animate()` calls individually via `injectPrefersReducedMotion()`.

Also: document the deliberate exemption for loaders (spinner/progress-bar/
brand-loader animate under reduced motion as essential feedback) in the loader
docs, mirroring the skeleton's explicit note.

**Found while implementing, deliberately left out of scope:** the **overlay**
enter/leave animations are not reduced-motion gated at all —
`overlay-container.component.css` has no `prefers-reduced-motion` block (unlike
`notification.component.css:208`), and `overlay/strategies/fullscreen-animation.ts`
(733 lines of JS transform math) is ungated too. Notification, accordion,
calendar and carousel all gate correctly, so this is the same
half-right/half-wrong shape as the rest of this section, but it is a
meaningfully bigger change than the items above (7 strategies × enter/leave,
plus the fullscreen JS path) and wants its own plan. Worth pairing with
`01-touch-gesture-overhaul.md`.

## 4. Error-code hygiene

- Add the missing `3900–3999 | Masonry` row to the master range table in
  `apps/docs/components/error-codes.md` (the `ET39xx` section already exists).
- Convert the 3 stray `throw new Error(...)` to coded `RuntimeError`s:
  `forms/cascader/cascader-from-query.ts:127`,
  `forms/rich-text-editor/rich-text-editor-trigger-with-query.ts:110`,
  `overlay/strategies/fullscreen-animation.ts:444`. Allocate codes in each
  domain's `*-errors.ts` + docs entries.

  **Corrected while implementing — only 1 of the 3 should be converted.** The
  cascader and RTE throws are not developer-error signals: their message is the
  **display-ready** text carried through an RxJS pipeline to the UI.
  `cascader.directive.ts:111`'s default `toErrorMessage` renders `error.message`
  verbatim in the column's error row, and
  `rich-text-editor-triggers.directive.ts:68` does the same for the token popup's
  `role="alert"` text — so a `RuntimeError` would print `ET3309: …` in front of
  the user. Both keep a plain `Error` and now carry a comment saying why, so the
  next grep-driven audit doesn't "fix" them. Only
  `fullscreen-animation.ts` was a real misuse signal → `ET1209`
  (`MISSING_ANIMATION_ORIGIN`).

  Also: the master range table was missing **four** rows, not one — Masonry
  (3900), Query error (4000), Floating action (4100) and Filter overlay (4200)
  all had their `## …` sections but no index entry. All four added.

## 5. SSR global-access stragglers (core)

- `core/src/lib/scrolling/scrollable.ts` (bare `document.documentElement`
  default param, `window.innerWidth/Height` in `createViewportRect`) and
  `core/src/lib/animations/animation-utils.ts:18` (`document.body` default) —
  align with the `DOCUMENT`-injection / guard convention used by
  `document-visibility.ts` and the SEO binding utils. These only run from
  browser event paths today, so this is hygiene, not a crash fix; don't
  restructure APIs, just make defaults lazy/guarded.
- `core/seo.directive.ts` is `@deprecated` and the only real SSR crash risk
  (bare `document` at 98-154). Don't fix — confirm removal is on the next
  major's checklist and note it there.

## Verification

Stories with `dir="rtl"` for sheets + notifications (mobile emulator for the
gesture); emulate `prefers-reduced-motion` in the storybook verification for
tabs underline / segmented button / PiP. Lint + changesets for
`@ethlete/components` and `@ethlete/core`; docs updates per item above.
