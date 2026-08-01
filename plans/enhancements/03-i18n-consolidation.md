# 03 - i18n consolidation

One coherent localization story instead of four disconnected mechanisms. Goal:
a consumer localizing an app (e.g. to German) has a single documented recipe,
and **every** user-facing string in the lib is overridable. This is not a
translation framework - the SDK stays English-by-default with DI overrides.

## Current state (verified 2026-07-30)

1. `injectLocale()`/`provideLocale()` - `signal('en')` in core. Reactive.
   Used by stream consent/error/PiP placeholder, grid, phone-input.
2. `DATE_LOCALE` - static date-fns `Locale` token
   (`forms/date-time/date-time-formats.ts:23-38`), feeds calendar names.
   Disconnected from (1): setting locale to `'de'` doesn't move the calendar.
3. Per-domain label tokens: `pagination-labels.ts`, `table/headless/table-labels.ts`,
   `carousel-labels.ts`, `breadcrumb-labels.ts`,
   `notification-config.ts:76`. Static, English defaults.
4. Ad-hoc `input()` defaults: `chip-remove.directive.ts:24` ('Remove'),
   `calendar.component.ts:27-28` (prev/next month), `select.component.ts:92`
   ('Clear'), `dropzone.component.ts:76-82` (Retry/Remove/Replace file).
5. **Non-overridable** hardcoded strings (static host bindings): RTE toolbar +
   link editor + floating toolbar + align/table tools (6 aria-labels),
   `stream-player-loading.component.ts:13`, `pip-close.directive.ts:13`,
   `pip-back.directive.ts:12`, `brand-loader.component.ts:37`.

## Design decisions

1. **`injectLocale()` stays the root signal.** Everything else derives from or
   coexists with it explicitly.
2. **Label tokens stay the per-domain override mechanism** - it's a good
   pattern (tree-shakeable, typed, discoverable). Consolidation means: every
   domain with user-facing strings gets one, consistently named and shaped
   (`provide<Domain>Labels` partial-override factory + `inject<Domain>Labels`).
   Do NOT invent a central string catalog - that couples domains.
3. **Make label tokens locale-reactive by accepting values or factories**: the
   provide function accepts `Partial<Labels>` or `() => Partial<Labels>`
   (running in injection context, so it can read `injectLocale()` and return a
   computed-backed object). Injectors expose signals (or keep plain strings
   where the existing token is plain - measure churn and pick one shape; do
   not ship a mix).
4. **Bridge `DATE_LOCALE`**: keep the token (a date-fns object can't be derived
   from a bare tag string automatically), but document the pairing in one
   place, and add a dev-mode warning when `injectLocale()` changes while
   `DATE_LOCALE` was never provided (likely-forgotten signal).
5. **Ad-hoc `input()` defaults**: keep the inputs (per-instance override is
   good UX) but default them from the domain's label token instead of a
   literal (`input(labels.remove())` shape → the input default reads the token).
6. **Kill non-overridable strings** (item 5 above): move each into its domain
   label token (new: RTE labels, stream/PiP labels, loader labels).

## Implementation order

1. Define the canonical token shape + write it up in the styleguide skill
   docs (`.claude/skills/styleguide` pointer, real text in apps/docs).
2. New tokens for RTE, stream/PiP, loader; wire the hardcoded strings.
3. Retrofit chip/calendar/select/dropzone input defaults to tokens
   (chip → chip labels token, calendar → calendar labels token, etc.).
4. Locale-reactivity for token factories; bridge warning for `DATE_LOCALE`.
5. Docs: one "Localization" guide page (apps/docs) with the full recipe: set
   `provideLocale`, provide `DATE_LOCALE`, override label tokens, list of all
   tokens. Verify every lib string is reachable from that page (grep for
   remaining literal English aria-labels/host strings as the acceptance check).

## Risks / notes

- Changing injector return shapes (plain → signal) is breaking for existing
  consumers of `inject*Labels` - check usage in consuming apps; if risky, add
  reactive variants alongside and deprecate.
- Don't touch semantic _content_ strings (stories/demos exempt).
- Changesets: `@ethlete/components` (+ `@ethlete/core` if locale utils move).
