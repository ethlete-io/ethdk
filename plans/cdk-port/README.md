# CDK → Components porting plan

Master plan for porting the remaining `libs/cdk` features into `libs/components`
(the active UI library; cdk is maintenance-only). This folder is written
incrementally across sessions — check **Planning progress** below to see what's
done and what the next planning chunk is.

## How to use this folder (for the implementing model)

- One file per feature: `NN-<feature>.md` (NN = priority order). Each file is a
  self-contained implementation plan: source inventory in cdk, target
  architecture in components, API decisions, styling/theming notes, stories,
  docs, changeset.
- Before implementing anything, read these skills: `component-architecture`
  (three-tier primitives/headless/default structure — mandatory for every new
  component), `theming` (all colors via `--et-surface-*` / `--et-theme-color-*`
  tokens), `changeset`, `docs`, `verify-in-storybook`.
- Every component CSS file must be wrapped in `@layer components { … }` and use
  `:where()` for config modifiers (see CLAUDE.md → Styling).
- Ports are **rewrites, not copies**: cdk code predates signals-first patterns.
  Rebuild with signal inputs/outputs, host bindings, the components-lib error
  code system, and self-registration — use an existing components-lib feature
  (e.g. `bracket`, which was just ported, or `selection-list`) as the reference
  shape.
- Each port ships as one PR: component + stories + docs page + changeset.

## Gap inventory (as of 2026-07-23)

### Already covered in components — no port needed

| cdk feature               | components equivalent                          | Note                                        |
| ------------------------- | ---------------------------------------------- | ------------------------------------------- |
| bracket                   | `bracket`                                      | Ported 2026-07 (commit 11ed986c)            |
| button                    | `button`                                       |                                             |
| icons                     | `icon`                                         | Verify no cdk-only icons are still consumed |
| overlay                   | `overlay`                                      | More evolved in components                  |
| progress-spinner          | `loader` (spinner, progress-bar, brand-loader) |                                             |
| scrollable                | `scrollable`                                   |                                             |
| tabs                      | `tabs`                                         |                                             |
| forms/checkbox            | `forms/checkbox`                               |                                             |
| forms/input               | `forms/input` (+ masked, otp, phone, color…)   |                                             |
| forms/label + forms/error | `forms/form-field`                             |                                             |
| forms/select              | `forms/select`                                 |                                             |
| forms/selection-list      | `forms/selection-list`                         |                                             |
| forms/radio               | `forms/selection-list` / `choice-field`        | Verify parity (see 90-parity-audits.md)     |
| forms/segmented-button    | `forms/selection-list`                         | Verify parity (see 90-parity-audits.md)     |
| forms/slide-toggle        | `forms/switch`                                 |                                             |
| forms/slider              | `forms/slider`                                 |                                             |

### To port (priority order)

| #   | cdk feature                          | Plan file                       | Size guess | Why this priority                                                                                                                                              |
| --- | ------------------------------------ | ------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | (prereq) QueryForm signal-forms port | `00-query-form-signal-forms.md` | M          | Lives in `libs/query`; blocks table Phases 2/7 (stub — needs planning session)                                                                                 |
| 01  | table + sort + filter headers        | `01-table.md`                   | XL         | **Green-field system, not a port** (cdk table's Angular-CDK base has type-safety issues). Absorbs cdk `sort` and filter headers. Planned in phases — see file. |
| 02  | pagination                           | `02-pagination.md`              | S–M        | Pairs with table; standalone value                                                                                                                             |
| 03  | skeleton                             | `03-skeleton.md`                | S          | Cheap win, widely used for loading states                                                                                                                      |
| 04  | accordion                            | `04-accordion.md`               | S–M        | Common primitive; modernization opportunity                                                                                                                    |
| 05  | breadcrumb                           | `05-breadcrumb.md`              | S          | Simple, router-aware                                                                                                                                           |
| 06  | carousel                             | `06-carousel.md`                | M–L        | Modernization opportunity (scroll-snap rewrite)                                                                                                                |
| 07  | masonry                              | `07-masonry.md`                 | M          | Modernization opportunity (CSS-first layout)                                                                                                                   |
| 08  | picture                              | `08-picture.md`                 | S          | Responsive image helper; may partially move to core                                                                                                            |
| 09  | query-error                          | `09-query-error.md`             | S–M        | Depends on @ethlete/query error shapes; rethink API                                                                                                            |
| 10  | filter                               | `10-filter.md`                  | S          | Two layers: floating-trigger port + new `provideFilterOverlay` composition (routed overlay + QueryForm badge + apply/reset) — see file                         |

### cdk `utils/` (not components — decide destination)

| util                         | Likely fate                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `floating-ui.ts`             | Probably obsolete — components overlay has its own positioning. Verify, then drop. |
| `navigation-dismiss-checker` | Check if core/components overlay already covers it; else move to `core`            |
| `router.ts`                  | Candidate for `core`                                                               |
| `swipe.ts`                   | Check against core drag utilities; else move to `core`                             |

## Cross-cutting opportunities (apply during ports, don't copy cdk behavior)

- **Signals-first APIs**: signal inputs/outputs/model(), no decorator inputs, no
  RxJS where a signal fits (see `styleguide` / `rxjs-signals` skills).
- **Three-tier architecture**: ship headless directives + default styled
  component per feature, so consumers can restyle (see `component-architecture`).
- **Modern CSS**: prefer platform features over JS — `<details>`+
  `interpolate-size` for accordion, scroll-snap for carousel, CSS columns/grid
  for masonry, `content-visibility` where relevant. Verify browser support
  against repo baseline first.
- **Theming**: everything through surface/color tokens; no hardcoded theme names.
- **A11y pass** per component: roles, keyboard nav, focus-visible, reduced motion.
- **Docs + stories are part of each port**, not follow-ups.

New-feature ideas that fall out of the ports (park here, separate plans later):
tree/data-grid extensions on top of table, virtualized table rows, breadcrumb
overflow collapsing, carousel autoplay with reduced-motion handling, skeleton
auto-shapes from content.

## Planning progress (update this every session)

- [x] Chunk 1 (2026-07-23): Inventory + this index file.
- [x] Chunk 2 (2026-07-23): `01-table.md` — green-field table system design in 8
      phases (typed columns, plugin features, virtualization via the select's
      windowing pattern, TableState export/restore). Also stubbed
      `00-query-form-signal-forms.md` as a prerequisite.
- [x] Chunk 2b (2026-07-23): `00-query-form-signal-forms.md` fully planned —
      new implementation alongside the untouched reactive-forms QueryForm, full
      parity checklist + hard parts (debounce batching, isResetBy reformulation,
      zoneless nav) documented. (Built on Angular signal forms, per the plan's
      decision #1 — an earlier "plain signals" note here was wrong: the
      components lib's controls are signal-forms `FormValueControl`s, so fields
      must be signal-forms fields to bind via `[formField]`. Verified during
      implementation 2026-07-23.)
- [x] Chunk 3 (2026-07-23): `02-pagination.md` (signals `page` model, ellipsis
      support cdk lacked, router-based URLs instead of window.location, real
      themed default styling, SEO head as opt-in import) and `03-skeleton.md`
      (keep CSS-driven core, add shape/text-lines helpers, surface-token
      shimmer instead of hardcoded grays).
- [ ] Chunk 3: `02-pagination.md` + `03-skeleton.md`.
- [x] Chunks 4–7 (2026-07-23): all remaining plans written —
      `04-accordion.md` (use `injectAnimatedBlockSize`, lazy content option),
      `05-breadcrumb.md` (keep template-registration + measure-and-collapse,
      fix missing nav/ol semantics and broken hardcoded colors),
      `06-carousel.md` (build on `scrollable` for native touch/snap; autoplay
      is the main new work; drop mask-slide), `07-masonry.md` (signals-first JS
      engine, per-item ResizeObserver, keep partial invalidation),
      `08-picture.md` (clean port + aspect-ratio/error-slot additions),
      `09-query-error.md` (model on stream-player-error, current client first,
      `injectLocale()` over language input), `10-filter.md` (rich-filter is a
      generic floating-button scroll pattern — rename, verify demand),
      `90-parity-audits.md` (radio/segmented/icons verdicts, utils
      destinations, cdk deprecation roadmap).

**Planning is complete.** All ports are specified; implementation can start
with any plan file (respect the 00 → 01 dependency). Open decisions are marked
inside each file. `90-parity-audits.md` also resolves the inventory's "verify
parity" notes: icons fully superseded; radio parity yes (native-input +
card-preset gaps recorded); segmented-button needs a tabs-mode decision.

## Implementation progress

Each plan file's own header is the detail (including deviations); this is the index.

- [x] `00-query-form-signal-forms.md` — signals QueryForm (2026-07-23)
- [x] `01-table.md` — green-field table, phases 1–9 (2026-07-24)
- [x] `02-pagination.md` — paginator + polish phase (2026-07-24)
- [x] `03-skeleton.md` — skeleton container/item/text (2026-07-24)
- [x] `04-accordion.md` — accordion + group + headless tier (2026-07-28)
- [x] `05-breadcrumb.md` — breadcrumb + overflow + routed outlet (2026-07-28)
- [x] `06-carousel.md` — phase 1 (scrollable composition, autoplay) + phase 2 (template slides, seamless
      looping, the slide-progress transition system with both drivers, `dim` + `wipe`) (2026-07-28)
- [ ] `07-masonry.md`
- [ ] `08-picture.md`
- [ ] `09-query-error.md`
- [ ] `10-filter.md`
- [ ] `90-parity-audits.md` — verdicts recorded; cdk deprecation roadmap still open
