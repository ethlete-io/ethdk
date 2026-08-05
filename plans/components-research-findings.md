# Components lib research: what is still open (2026-07-30 pass)

Five parallel source-verified audits of `libs/components` (+ `libs/core` primitives) ran on
2026-07-30: forms controls, overlay/popup domains, data display, cross-cutting concerns
(RTL/i18n/a11y/SSR/sizing/errors/API hygiene), and a touch/gesture deep-dive. Complements
`opportunities.md` (2026-07-23: new-component candidates, platform decisions) - that pass covered
what does not exist yet, this one covered gaps **inside** what does.

Everything the pass judged worth doing became one of twelve implementation plans, and all twelve
shipped between 2026-07-30 and 2026-07-31 - the audit findings and the plans went with them. What
survives here is only what is still actionable: the items deliberately never planned, what the
shipped work deferred, and the strengths not worth re-auditing.

## 1. Recorded but NOT planned (backlog; revisit on demand)

- **Stream unified control bar** - biggest single stream gap (no volume level,
  playback rate, captions, fullscreen, or keyboard shortcuts in the
  `StreamPlayer` abstraction; docs explicitly punt controls to consumers).
  High value **but** requires per-platform capability work across 8 adapters -
  needs its own planning session; don't half-bake it.
- Select: mobile bottom-sheet presentation (inconsistent with cascader/
  date-time siblings, which swap below `md`).
- Cascader: branch-level "select all descendants" in multi mode.
- Table: row grouping/banding, row drag-reorder, bulk-selection toolbar;
  tree/data-grid extensions.
- Grid: per-item lock/static flag (grid-wide `readOnly` only), duplicate action.
- Masonry: multi-column item spanning, feed virtualization.
- Carousel: thumbnail strip; vertical orientation surfaced on default component.
- Bracket: zoom/pan/minimap for large brackets; export.
- Dropzone: drag-to-reorder files; crop-before-upload hook; chunked uploads.
- Color input: alpha channel, swatches (deliberate native-wrapper scope today).
- Skeleton: auto-shapes.
- Menubar pattern; lazy `loadComponent` overlay-router routes; tooltip shared
  delay groups; tabs closable/reorderable; menu `loop` opt-out.
- Sizing tokens: `{sm,md,lg}` consts duplicated per family, no shared core
  token; `pagination.component.ts:85` inlines the union, breaking convention.
- Loader: buffer segment, visible percentage label.
- Haptics hooks (`navigator.vibrate`) at gesture commit points.
- OTP resend affordance; tag-input Backspace-to-edit; per-tag validation;
  RTE text color/highlight + word count; switch thumb icons.

All three query-devtools items this pass raised - free-text search, the timing waterfall and
whole-session export - shipped 2026-08-04; `apps/docs/components/query-devtools.md` is the
current surface.

## 2. Deferred by the shipped work

Two items the plans reached and deliberately left open. Each is small enough to fold
into the next relevant pass rather than plan on its own. (Two others in this original
four-item list have since closed: a foreign-time-zone renderer was decided against, and
the range-input error gap is fixed - both below.)

- **≥ 44 px touch-target audit** (from the touch/gesture audit). Every candidate either changes
  layout or steals neighbouring taps, so it needs measuring on a device
  (`verify-in-mobile-emulator`) rather than reasoning: the slider's whole
  `.et-slider-interaction` row is already the target and it is 28 px tall, so growing
  it moves the label/hint; rating icons sit adjacent in a flex row, so a symmetric
  44 px area makes each star steal its neighbour's taps and only block-direction
  growth is safe; for checkbox/radio the target is in practice the whole
  `et-choice-field` label row, and the bare 20 px box only matters for label-less uses
  (table select-all), where a 44 px overlay would reach into adjacent rows.
- **Overlay enter/leave reduced-motion gating** (from the reduced-motion consistency audit). `overlay-container.component.css`
  has no `prefers-reduced-motion` block (unlike `notification.component.css:208`), and
  `overlay/strategies/fullscreen-animation.ts` (733 lines of JS transform math) is
  ungated too. Notification, accordion, calendar and carousel all gate correctly, so this is the
  same half-right shape the rest of that audit found and fixed - but 7 strategies × enter/leave
  plus the fullscreen JS path is a meaningfully bigger change and wants its own plan.
- ~~Rendering a foreign time zone~~ - closed 2026-08-05, won't do. The contract shipped as docs:
  every `Date` is local wall-clock and `valueFormat="yyyy-MM-dd"` is the fix for calendar dates.
  Zoned arithmetic through calendar + time picker + all four inputs, a new dependency, and different
  value semantics is a real cost for a need nothing has surfaced - decided not worth carrying as an
  open question.
- ~~Range per-field errors don't reach the field's single error area~~ - resolved 2026-08-05.
  `DateRangeInputDirective` now presents a merged view to the form field: `errors` stays the
  `FormValueControl` input signal forms writes the range field's _own_ errors into (required, since
  that binding only ever targets a property literally named `errors`), but what the form field
  reads is a separate object whose `errors` prefers `inject(FORM_FIELD).state().errorSummary()`
  (own + descendants) and falls back to the plain `errors` input outside a schema-bound context. Not
  needed for phone/OTP input - neither has a per-side schema-error use case today; revisit the same
  pattern there only if one comes up.

## 3. Verified strengths (don't re-audit)

FormValueControl contract (`disabled/readonly/invalid/errors/required/touched`)
fully consistent across all controls; mixed-state contract CI-enforced. Menu
already has submenus/context-menu/typeahead/search/selection groups. Overlay
already has drag-to-dismiss (4 directions), unsaved-changes guards, routing,
origin-clone fullscreen animation, correct stacked-dialog Escape/focus.
Notification has update-in-place, hover/focus pause, FLIP stack, correct
`role="log"` live region. Table ships resize/reorder/sticky/selection/
visibility/footers/expansion/state-persistence/virtualization. Zero TODO/FIXME
in the audited domains except the known bracket one. Public API hygiene clean.
119 files use SSR-safe render guards. Error-code system consistently adopted
(189 refs, ~35 domain files).

Also already built, against stale notes elsewhere: **table virtualization**
(`table-virtual-scroll.directive.ts`), **carousel reduced-motion autoplay handling**
(`carousel-autoplay.directive.ts` pause reason) and **breadcrumb overflow collapsing**.
