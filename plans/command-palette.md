# Command palette

Picked off `plans/component-improvements-triage.md` on 2026-08-18, the second `L` project after the
colour input's custom picker. The backlog held two sentences and no research, and it flagged scope
creep as the real risk, so the scope was settled with the user before any code.

## Scope, settled 2026-08-18

Four calls, all confirmed by the user:

1. **A registry service is the command source.** The app registers commands, so a lazily loaded
   feature area can contribute one. The Tier 3 component renders the registered list. There is no
   second, projected-item path - that doubling is the scope creep the triage warned about, and a
   palette of template-declared items is a menu in a dialog, which the menu already does.
2. **The palette filters, with a fuzzy scorer that reports match ranges.** The menu leaves filtering
   to the consumer, who writes a plain `includes`; a registry-driven list has no consumer template to
   filter in, and substring ranking reads badly on long command names.
3. **A flat list in v1.** One query, one ranked list, group headings for structure. Nested command
   pages are the main creep vector and can arrive later without a break.
4. **The shortcut is opt-in.** The SDK ships a directive the app must add, so nothing takes a global
   key unasked. The macOS `event.code` trap and the printed label are then solved once.

## What already existed

Reused as-is, which is why this is cheaper than an `L` normally is:

- `overlay/strategies/dialog.strategy.ts` - the modal centered dialog.
- `kbd/` - `et-kbd` prints a `mod+k` chord with the current platform's glyphs.
- `overlay-opener.ts` / `overlay-definition.ts` - `defineOverlay` plus `createOverlayOpener`.
- `defineRootProvider` / `defineLabels` from `@ethlete/core` - the registry and the label set.

Missing, so written here: the scorer, the registry, and a chord matcher. There was no chord matcher
anywhere - `kbd-keys.ts` only rendered chords. The query devtools matched its own chord inline.

## What shipped

- `command-palette-registry.ts` - `registerCommands(source)` for the injection-context case, plus
  `injectCommandPaletteRegistry().register()` for a registration that must outlive its component. A
  source is an array **or a signal**, so a command whose `disabled` depends on state needs no second
  registration.
- `headless/internals/fuzzy-match.ts` - the scorer, with match ranges for highlighting.
- `headless/internals/rank-commands.ts` - filtering, ranking, tie-breaking and grouping.
- `headless/command-palette.directive.ts` + `-search.directive.ts` - Tier 2 behaviour.
- `command-palette.component.*` and `command-palette-item.component.*` - Tier 3.
- `command-palette.overlay.ts` - `COMMAND_PALETTE_OVERLAY` and `injectCommandPalette()`.
- `command-palette-shortcut.directive.ts` - the opt-in chord, which toggles.
- `kbd/kbd-match.ts` - `matchesKbdChord`, and `canonicalKbdKey` exported from `kbd-keys.ts`.

## Traps this turned up

- **A flat consecutive bonus ranks a fuzzy match above an exact substring.** With one fixed bonus per
  adjacent character, the query `user` scored `Unset serial` (a strong `u` plus `ser`) above `Add user`.
  The bonus has to grow with the length of the run. Two spec cases pin this.
- **The keyboard must walk the rendered order, not the ranked order.** `groupResults` moves ungrouped
  commands to the front, so the flat ranked order and the DOM disagree - Arrow Down jumped between
  groups until `orderedResults` was derived from `groups()`. Caught by the component spec, not by eye.
- **A bare `etCommandPaletteShortcut` attribute binds `''`, not the input's default.** So the documented
  no-value form silently listened for a chord that can never fire. Fixed with a `transform` that falls
  back to `mod+k`. The dev-mode chord check had the same root cause and read the default instead of the
  consumer's value, because it ran in the constructor - it is in `afterNextRender` now.
- **A strategy already owns `containerClass`.** Passing one to `dialogOverlayStrategy` throws `ET1204`
  ("multiple layout classes"). Use `panelClass` for a domain's own hook; both land on the same pane
  element, so the CSS selector works either way.
- **A text node in an `@else` branch carries the template's indentation into the output.** The label read
  `" Create  tab le "` around the `<mark>`. Whitespace-only nodes _between elements_ are stripped, so
  every branch has to render an element - `<span>{{ segment.text }}</span>`, not bare interpolation.
- **Rows must reserve the icon column together.** Without it, labels stepped in and out as the query
  changed which of the listed commands had an icon. `hasIcons` on the directive decides it for the list.
- **`scrollIntoView` does not exist in the test DOM.** An active row scrolling itself has to call it
  optionally, or every component spec logs an error.

## Deliberately not in v1

- Nested command pages, recents and frequency ordering, and async command sources.
- Binding a command's own `shortcut`. It is printed only; an app binds what it wants, so one command
  cannot silently claim a key another feature needs.
- Matching a command's `description`. It is prose, and matching it produces noisy results.

## Not verified

`nx run treeshake:bundle-goldens` could not run: another session had `libs/query` mid-edit, and
`query:build:production` fails on it. The palette adds no golden entry - the file keeps one per big
domain and menu, grid and scheduler have none - but `components-floor` should be re-checked once that
build is green.
