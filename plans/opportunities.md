# Opportunities: improvements & new additions

Research done 2026-07-23 (source-verified scans of `libs/components` +
`libs/core`). Written alongside the `plans/cdk-port/` set (all shipped and since
deleted, along with the cdk deprecation roadmap it fed - every cdk export now
carries an `@deprecated` tag naming its successor) - nothing here overlapped
those plans. Unprioritized backlog; pick items into real plans as needed.

> A second research pass (2026-07-30) covering gaps _inside_ existing
> components - touch/gesture, RTL/i18n/a11y consistency, per-domain feature
> gaps - lived in `components-research-findings.md`. All twelve implementation
> plans it produced have shipped, including the last touch-target fixes, so the
> file itself is gone too.

## New components

**Tree view** - **done** (2026-08-05). Shipped as `et-tree` + headless `[etTree]`
(per-branch lazy loading via `TreeDataSource`, flat `visibleRows()` rendering with
explicit `aria-level`/`posinset`/`setsize`, roving tab stop, expand/collapse keys,
type-ahead, `*`, three selection modes, per-branch retry). The item's premise was
wrong: `cascader-tree.ts` was already public from the cascader's headless barrel, and
it is only a data-source contract - no expand state, no focus model, no rendering. The
tree defines its own structurally identical `TreeDataSource`, so one source object
drives both without coupling the domains.

**Toolbar** - **done** (2026-08-05). Shipped as `et-toolbar` + headless
`[etToolbar]` (roving tab stop, arrow/Home/End, RTL-aware, orientation); the RTE's
static toolbar dropped ~78 lines to adopt it. `et-grid-item-toolbar` was left alone:
it is a visual wrapper with no `role="toolbar"` and no keyboard model, so converting
it would change grid behaviour. The RTE's floating toolbar is `role="toolbar"` but
every button is `tabindex="-1"` by design (it must never take focus from the
selection), so it needs no roving focus either.

**Divider** - **done** (2026-08-05). Shipped as `et-divider` (orientation +
`decorative`, spacing/inset/thickness tokens); the RTE's two ad-hoc
`et-rte-toolbar-divider` spans now use it. The item's premise was wrong: the other
sites it named (tabs, split-button, select-option-group, select-panel,
overlay-container) are borders on structural elements, not separators, and were
left alone.

**Kbd** - **done** (2026-08-06). Shipped as `et-kbd`: `keys="mod+shift+k"` renders one
`<kbd>` cap per key with the current platform's glyphs (`⌘ ⇧ K` on Apple, `Ctrl Shift K`
elsewhere), aliases for the spellings apps already use, and `KBD_PLATFORM` / a `platform`
input to pin it. The premise held, but neither existing shortcut site became an adopter:
`et-menu-item-shortcut` is a trailing _slot_ (also carrying the `›` submenu chevron), not a
keycap, so a kbd composes inside it rather than replacing it; and the query devtools' caps
are deliberately isolated - the toggle is `ShadowDom` on purpose and the panel paints from
its own `--_et-qdt-*` chrome, not surface theming. What did consolidate is the Apple
detection both hand-rolled: `queryDevtoolsShortcutLabel()` now calls `detectKbdPlatform()`.

Low / opportunistic: stat tile, timeline, command palette (leans on
existing overlay+menu so cheaper than it looks, but scope-creep risk),
back-to-top (covered by `floating-action`'s generic floating trigger).

Already covered - don't rebuild: date-range picker, segmented control,
loaders, popover-as-API (overlay), rating/switch, banner/inline alert, avatar
(+ group), card, badge, empty state, description list, copy-to-clipboard
button (`copy-button`), stepper/progress-steps.

## Platform modernization - team decisions recorded 2026-07-23

Repo has no browserslist config → implicit evergreen baseline. Already
adopted (don't re-plan): `:has()` widely, `@starting-style` in rating +
otp-input, `container-type` in stream/pip.

- **Animated lifecycle stays. Decided - do not plan a replacement.**
  `animatable.directive.ts` + `animated-lifecycle.directive.ts` took a long
  time to fine-tune (interrupts, batching, nested trees, forced-instant
  states); `@starting-style`/`allow-discrete` cannot replace all of it. New
  simple show/hide cases may use `@starting-style` directly (precedent:
  rating, otp-input), but the directive pair is not a migration target.
- **`<dialog>`/top-layer: rejected.** The native top layer breaks consumer
  apps that rely on z-index layering to push their own elements above modals
  (magic z-indexes over `z-index: 1000` work today; nothing beats the top
  layer). The overlay system keeps its portal + z-index approach. This
  reasoning applies equally to the **Popover API** for tooltip/toggletip/menu
  - same top-layer semantics, same rejection.
- **View Transitions: agreed in principle, not yet baseline** (Firefox lacks
  same-document VT). Highest-value target when it lands:
  `overlay/strategies/fullscreen-animation.ts` (733 lines of origin→viewport
  transform math + trigger cloning; VT snapshots pixels, which may also
  sidestep the Angular style-unload constraint that forced cloning - see the
  no-clone-animations rule). Also `flip-animation.ts` (tab underline,
  segmented button). **Re-check browser support before any future planning.**
- **Chrome-only for now - re-scan when Firefox/Safari ship**: CSS anchor
  positioning (would shrink `overlay-position.ts`'s floating-ui usage - do
  NOT swap yet), `interpolate-size`/`calc-size` (would replace
  `animated-block-size.ts`; a `@supports` progressive-enhancement fast path
  is possible), `field-sizing: content` (would delete
  `textarea-autosize.ts` + ~70–90 lines of `textarea.directive.ts`).

## DX / tooling

- **Component scaffolding generator** - **done** (2026-08-05). Shipped as
  `nx g @ethlete/components:component <name>` (`--tier=both|component|headless`,
  `--errors`, plus opt-outs for spec/stories/docs). It writes the domain folder,
  the `@layer components` stylesheet, the imports barrel, a passing spec and a
  story, then wires the lib barrel, the docs page + sidebar entry and - with
  `--errors` - claims the next free block in the code range table. Self-registration
  was left out of the scaffold: it only applies to sub-directives, which a fresh
  domain doesn't have yet.
- **Test harnesses**: `forms/testing/` has exactly one utility (the
  `mixed-state-contract`). No CDK-`ComponentHarness`-style drivers - every
  spec talks to the DOM directly. Worth considering as more controls land;
  not urgent.

## Next major - removal checklist

Nothing else tracks this, so it lives here until a real changelog/migration doc
exists.

- `core/seo.directive.ts` - **done** (2026-08-05). Deleted along with
  `seo.directive.types.ts`; the SEO guide gained a per-`SeoConfig`-key migration
  table. The other `core` global-access stragglers (`scrolling/scrollable.ts`,
  `animations/animation-utils.ts`) were guarded instead, since they stay.
  **`@ethlete/core` consumers still on the directive must migrate** - 15 view
  components in `fut-frontend` (`libs/domain/voting-public/campaigns`) use it.

## Tech debt notes (codebase is very clean - 0 TODOs left)

- `bracket/index.ts` - **done** (2026-08-05). `./core` and `./linked` are now
  explicit named re-exports of the data types, enums, relations and swiss group
  types; the engine builders stay internal to the lib.
- Docs coverage: complete - every public domain has a docs page.
