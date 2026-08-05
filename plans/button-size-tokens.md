# `et-icon-button` / `et-fab`: no public sizing tokens, unlike `et-button`

Found 2026-08-05 restyling `fut-frontend`'s hub app buttons (`@ethlete/components@1.0.0-next.36`)
to a new pill-shaped, tighter size scale (16/24/32/40/48px) via a consumer-side CSS override -
no SDK edits, per the app's own rule that this checkout is read-only from consumer work.

`ButtonComponent` (the label button) does this right: every per-size value - `padding`,
`font-size`, `gap`, `line-height`, `border-radius` - is a `@property`-declared, dash-prefixed
token (`--et-button-*`) that `button.component.css`'s `:where([data-size='...'])` blocks merely
set defaults for. A consumer can override any of them from outside with a plain custom-property
assignment, at any specificity, no internals required.

`IconButtonComponent` and `FabComponent` don't follow that pattern:

- `icon-button.component.css` hardcodes `width`/`height` as literal per-size values (`2.4rem`,
  `3.1rem`, ...) directly in the `:where([data-size='...'])` blocks - there is no custom property
  for diameter at all.
- Both components do expose their icon/label sizing through custom properties
  (`--_et-icon-button-icon-size`, `--_et-fab-size`, `--_et-fab-label-font-size`,
  `--_et-fab-icon-size`, `--_et-fab-contents-gap`) - but every one of them uses the `--_et-`
  prefix, which the rest of the codebase (e.g. `.et-button`'s own `--_et-button-background`)
  uses consistently to mean "private, internal indirection, not a supported override surface."

**Workaround used**: the consumer override sets `width`/`height` directly (unavoidable - no
token exists to hook), and separately writes to the four private `--_et-*` variables above to
resize the icon/label/gap per size. Because they're consumed via plain `var()` rather than
declared `@property`, writing to them from outside works today (no syntax/initial-value
enforcement to fight) - but it's reaching past a boundary the codebase's own naming convention
says is private, with no guarantee it survives a refactor.

**Suggested fix:** give `IconButtonComponent` and `FabComponent` the same treatment
`ButtonComponent` already has - promote diameter (`--et-icon-button-size` /
`--et-fab-size`), icon size, label font-size, and contents-gap to `@property`-declared
`--et-*` (not `--_et-*`) tokens with the current per-size values as defaults, consumed by the
component CSS exactly as it does today. That turns "set a private variable and hope" into the
same clean override surface the label button already offers.
