# Parallel backlog - latest decisions (Q203 and later)

Decisions live in `apps/ethlete-studio/docs/adr/` since 2026-11-04 (ADR 0001). New decisions go only there.

### Decision records and plan size (Tom, 2026-11-04, finding 385)

- ADR 0001: [Every Studio decision is an ADR](../../../apps/ethlete-studio/docs/adr/0001-every-studio-decision-is-an-adr.md)
- ADR 0002: [design-to-code.md keeps only open findings](../../../apps/ethlete-studio/docs/adr/0002-design-to-code-md-keeps-only-open-findings.md)
- ADR 0003: [The push check fails on a missing or stale ADR build state](../../../apps/ethlete-studio/docs/adr/0003-the-push-check-fails-on-a-missing-or-stale-adr-build-state.md)
- ADR 0004: [The doc agent searches the ADRs before every grill question](../../../apps/ethlete-studio/docs/adr/0004-the-doc-agent-searches-the-adrs-before-every-grill-question.md)

### Pixel check and blocker wording (Tom, 2026-11-04, findings 374 and 375)

- ADR 0005: [The B313/B321 WebKit pixel check runs locally first](../../../apps/ethlete-studio/docs/adr/0005-the-b313-b321-webkit-pixel-check-runs-locally-first.md)
- ADR 0006: [The stale-record blocker wording](../../../apps/ethlete-studio/docs/adr/0006-the-stale-record-blocker-wording.md)

### CLI copy build at restart (Tom, 2026-11-04, finding 372)

- ADR 0007: [The restart click approves building a new CLI copy](../../../apps/ethlete-studio/docs/adr/0007-the-restart-click-approves-building-a-new-cli-copy.md)

### Silent catchError decisions (Tom, 2026-11-04, finding 370)

- ADR 0008: [no-silent-catch-error is an error in Studio](../../../apps/ethlete-studio/docs/adr/0008-no-silent-catch-error-is-an-error-in-studio.md)
- ADR 0009: [The builder commits the design files left by bbbc9d27f](../../../apps/ethlete-studio/docs/adr/0009-the-builder-commits-the-design-files-left-by-bbbc9d27f.md)

### UI without a design (Tom, 2026-11-04, finding 368)

- ADR 0010: [UI built without a design stays, marked, with a sketch opened at once](../../../apps/ethlete-studio/docs/adr/0010-ui-built-without-a-design-stays-marked-with-a-sketch-opened-at-once.md)
- ADR 0011: [A Studio UI commit needs a green design compare](../../../apps/ethlete-studio/docs/adr/0011-a-studio-ui-commit-needs-a-green-design-compare.md)

### Studio runs committed code only (Tom, 2026-11-04, findings 363-365)

- ADR 0012: [Studio runs only committed code, and only after the click](../../../apps/ethlete-studio/docs/adr/0012-studio-runs-only-committed-code-and-only-after-the-click.md)
- ADR 0013: [The design server never restarts itself](../../../apps/ethlete-studio/docs/adr/0013-the-design-server-never-restarts-itself.md)
- ADR 0014: [No vite HMR; the frontend reloads on click](../../../apps/ethlete-studio/docs/adr/0014-no-vite-hmr-the-frontend-reloads-on-click.md)
- ADR 0015: [The Rust host restarts only on click](../../../apps/ethlete-studio/docs/adr/0015-the-rust-host-restarts-only-on-click.md)

### WebKit soak check decisions (Tom, 2026-11-04, finding 365)

- ADR 0016: [The WKWebView soak check is a macOS CI gate](../../../apps/ethlete-studio/docs/adr/0016-the-wkwebview-soak-check-is-a-macos-ci-gate.md)
- ADR 0017: [Slow machines are covered by work budgets, not speed](../../../apps/ethlete-studio/docs/adr/0017-slow-machines-are-covered-by-work-budgets-not-speed.md)

### Person names in the product (Tom, 2026-11-04, finding 362)

- ADR 0018: [A check fails on person names in product files](../../../apps/ethlete-studio/docs/adr/0018-a-check-fails-on-person-names-in-product-files.md)
- ADR 0019: [The person in the product is "human"](../../../apps/ethlete-studio/docs/adr/0019-the-person-in-the-product-is-human.md)

### Commit volume decisions (Tom, 2026-11-04)

- ADR 0020: [One plan commit per grill round or finished slice](../../../apps/ethlete-studio/docs/adr/0020-one-plan-commit-per-grill-round-or-finished-slice.md)
- ADR 0021: [One code commit per slice, no history rewrite](../../../apps/ethlete-studio/docs/adr/0021-one-code-commit-per-slice-no-history-rewrite.md)
- ADR 0022: [One commit per sketch round and one per merge](../../../apps/ethlete-studio/docs/adr/0022-one-commit-per-sketch-round-and-one-per-merge.md)
- ADR 0023: [The commit rules live in the skills; a hook only if needed](../../../apps/ethlete-studio/docs/adr/0023-the-commit-rules-live-in-the-skills-a-hook-only-if-needed.md)

### Variant notes, model name and order of the recovered wishes (Tom, 2026-11-02)

- ADR 0024: [Variant and part notes are short and in the designer's words](../../../apps/ethlete-studio/docs/adr/0024-variant-and-part-notes-are-short-and-in-the-designers-words.md)
- ADR 0025: [A variant head shows the provider logo and short model name](../../../apps/ethlete-studio/docs/adr/0025-a-variant-head-shows-the-provider-logo-and-short-model-name.md)
- ADR 0026: [A40 follows the sidebar block; A38 and A39 follow A37](../../../apps/ethlete-studio/docs/adr/0026-a40-follows-the-sidebar-block-a38-and-a39-follow-a37.md)

### Solo focus, sketch view, behavior tests and pre-push decisions (Tom, 2026-11-04)

- ADR 0027: [Studio is a solo-user tool first; multi-user is parked](../../../apps/ethlete-studio/docs/adr/0027-studio-is-a-solo-user-tool-first-multi-user-is-parked.md)
- ADR 0028: [No reject button in the sketch view](../../../apps/ethlete-studio/docs/adr/0028-no-reject-button-in-the-sketch-view.md)
- ADR 0029: [The switch off-track hover-edge e2e is deleted](../../../apps/ethlete-studio/docs/adr/0029-the-switch-off-track-hover-edge-e2e-is-deleted.md)
- ADR 0030: [Scheduler e2e locators use aria-label](../../../apps/ethlete-studio/docs/adr/0030-scheduler-e2e-locators-use-aria-label.md)
- ADR 0031: [The scheduler closes the appointment tooltip when it opens the edit surface](../../../apps/ethlete-studio/docs/adr/0031-the-scheduler-closes-the-appointment-tooltip-when-it-opens-the-edit-su.md)
- ADR 0032: [The tooltip does not consume Escape](../../../apps/ethlete-studio/docs/adr/0032-the-tooltip-does-not-consume-escape.md)
- ADR 0033: [No e2e in pre-push](../../../apps/ethlete-studio/docs/adr/0033-no-e2e-in-pre-push.md)
- ADR 0034: [libs/components has zero runtime import cycles](../../../apps/ethlete-studio/docs/adr/0034-libs-components-has-zero-runtime-import-cycles.md)
- ADR 0035: [A tooltip in a dialog takes two Escapes](../../../apps/ethlete-studio/docs/adr/0035-a-tooltip-in-a-dialog-takes-two-escapes.md)
- ADR 0036: [Studio checks leave the git hook](../../../apps/ethlete-studio/docs/adr/0036-studio-checks-leave-the-git-hook.md)
- ADR 0037: [Build-ready stops a defect without the hook; CI is the backstop](../../../apps/ethlete-studio/docs/adr/0037-build-ready-stops-a-defect-without-the-hook-ci-is-the-backstop.md)
- ADR 0038: [Pre-push keeps only fast checks that prevent a certain CI failure](../../../apps/ethlete-studio/docs/adr/0038-pre-push-keeps-only-fast-checks-that-prevent-a-certain-ci-failure.md)
- ADR 0039: [The go.json commit hook stays until go.json goes](../../../apps/ethlete-studio/docs/adr/0039-the-go-json-commit-hook-stays-until-go-json-goes.md)
- ADR 0040: [Product order after the B291 push](../../../apps/ethlete-studio/docs/adr/0040-product-order-after-the-b291-push.md)
- ADR 0041: [Build-ready status words](../../../apps/ethlete-studio/docs/adr/0041-build-ready-status-words.md)
- ADR 0042: [Agent progress shows on the part beside the build-ready status](../../../apps/ethlete-studio/docs/adr/0042-agent-progress-shows-on-the-part-beside-the-build-ready-status.md)

### Studio order, explorer, merge canvas and "build-ready" decisions (Tom, 2026-11-02)

- ADR 0043: [Order of list A](../../../apps/ethlete-studio/docs/adr/0043-order-of-list-a.md)
- ADR 0044: [Visible UI starts with a sketch Tom picks](../../../apps/ethlete-studio/docs/adr/0044-visible-ui-starts-with-a-sketch-tom-picks.md)
- ADR 0045: [The title bar gets a sketch with window controls, search and update button](../../../apps/ethlete-studio/docs/adr/0045-the-title-bar-gets-a-sketch-with-window-controls-search-and-update-but.md)
- ADR 0046: [The explorer tree lists parts only](../../../apps/ethlete-studio/docs/adr/0046-the-explorer-tree-lists-parts-only.md)
- ADR 0047: [The merge view is one canvas again](../../../apps/ethlete-studio/docs/adr/0047-the-merge-view-is-one-canvas-again.md)
- ADR 0048: [Build-ready replaces go and acceptance](../../../apps/ethlete-studio/docs/adr/0048-build-ready-replaces-go-and-acceptance.md)
- ADR 0049: [The no-part app region check runs in pre-push](../../../apps/ethlete-studio/docs/adr/0049-the-no-part-app-region-check-runs-in-pre-push.md)

### Title bar window controls decisions (Tom, 2026-11-02)

- ADR 0050: [Studio keeps its own title bar; macOS keeps the native traffic lights](../../../apps/ethlete-studio/docs/adr/0050-studio-keeps-its-own-title-bar-macos-keeps-the-native-traffic-lights.md)
- ADR 0051: [Linux window controls follow the desktop button layout](../../../apps/ethlete-studio/docs/adr/0051-linux-window-controls-follow-the-desktop-button-layout.md)
- ADR 0052: [Linux window buttons are round GNOME style](../../../apps/ethlete-studio/docs/adr/0052-linux-window-buttons-are-round-gnome-style.md)

### Surfaces follow the elevation system, not picked names (Tom, 2026-10-31, Q203-Q206)

- ADR 0053: [Parts take their surface from kit attributes, not surface classes](../../../apps/ethlete-studio/docs/adr/0053-parts-take-their-surface-from-kit-attributes-not-surface-classes.md)
- ADR 0054: [Every Studio part migrates to the surface attributes](../../../apps/ethlete-studio/docs/adr/0054-every-studio-part-migrates-to-the-surface-attributes.md)
- ADR 0055: [DENIED-CLASS denies et-surface classes outside foundations](../../../apps/ethlete-studio/docs/adr/0055-denied-class-denies-et-surface-classes-outside-foundations.md)
- ADR 0056: [Colour follows the theme-scope rule too](../../../apps/ethlete-studio/docs/adr/0056-colour-follows-the-theme-scope-rule-too.md)
- ADR 0057: [The computed elevations are accepted; structure changes, not elevations](../../../apps/ethlete-studio/docs/adr/0057-the-computed-elevations-are-accepted-structure-changes-not-elevations.md)
- ADR 0058: [Overlays in parts use the SDK static overlay renderers](../../../apps/ethlete-studio/docs/adr/0058-overlays-in-parts-use-the-sdk-static-overlay-renderers.md)
- ADR 0059: [Rows use the SDK interactive surface tint](../../../apps/ethlete-studio/docs/adr/0059-rows-use-the-sdk-interactive-surface-tint.md)
- ADR 0060: [The comment pin is one interactive auto surface](../../../apps/ethlete-studio/docs/adr/0060-the-comment-pin-is-one-interactive-auto-surface.md)
- ADR 0061: [Every floating element takes the SDK subtle overlay border](../../../apps/ethlete-studio/docs/adr/0061-every-floating-element-takes-the-sdk-subtle-overlay-border.md)
- ADR 0062: [The Q211 comment pin round is accepted](../../../apps/ethlete-studio/docs/adr/0062-the-q211-comment-pin-round-is-accepted.md)
- ADR 0063: [The studio overlay round is accepted](../../../apps/ethlete-studio/docs/adr/0063-the-studio-overlay-round-is-accepted.md)
- ADR 0064: [The contrast rule skips the outer border of a floating panel](../../../apps/ethlete-studio/docs/adr/0064-the-contrast-rule-skips-the-outer-border-of-a-floating-panel.md)
- ADR 0065: [Focus-region and focus-ring APIs come after the MVP](../../../apps/ethlete-studio/docs/adr/0065-focus-region-and-focus-ring-apis-come-after-the-mvp.md)
- ADR 0066: [The zoom chip takes the SDK overlay shadow](../../../apps/ethlete-studio/docs/adr/0066-the-zoom-chip-takes-the-sdk-overlay-shadow.md)
- ADR 0067: [Unused SDK base parts sit in a computed "Not used in Studio" subtree](../../../apps/ethlete-studio/docs/adr/0067-unused-sdk-base-parts-sit-in-a-computed-not-used-in-studio-subtree.md)
- ADR 0068: [Undeclared controls on pages/sketches get a tool fix or a sketch round](../../../apps/ethlete-studio/docs/adr/0068-undeclared-controls-on-pages-sketches-get-a-tool-fix-or-a-sketch-round.md)
- ADR 0069: [Canonical Tailwind classes are fixed in one mechanical pass](../../../apps/ethlete-studio/docs/adr/0069-canonical-tailwind-classes-are-fixed-in-one-mechanical-pass.md)
- ADR 0070: [Glued interpolated classes are fixed in sketch rounds](../../../apps/ethlete-studio/docs/adr/0070-glued-interpolated-classes-are-fixed-in-sketch-rounds.md)
- After the MVP (pilot slice 1 tool gap, 2026-10-31): no CLI command prints the rendered HTML of a part or of its
  implementation; the pilot dumped it with its own Playwright script. A `design dom <part>` (or a compare flag) would
  remove that step.
- ADR 0071: [The live canvas is a projected slot](../../../apps/ethlete-studio/docs/adr/0071-the-live-canvas-is-a-projected-slot.md)
- ADR 0072: [Builder order after pilot slice 1](../../../apps/ethlete-studio/docs/adr/0072-builder-order-after-pilot-slice-1.md)
- ADR 0073: [Every Studio view needs a part that covers it](../../../apps/ethlete-studio/docs/adr/0073-every-studio-view-needs-a-part-that-covers-it.md)
- ADR 0074: [The builder reports only to the grill session](../../../apps/ethlete-studio/docs/adr/0074-the-builder-reports-only-to-the-grill-session.md)
- ADR 0075: [Token savings that last](../../../apps/ethlete-studio/docs/adr/0075-token-savings-that-last.md)
- ADR 0076: [Popovers in pages embed an SDK anchored-dialog part](../../../apps/ethlete-studio/docs/adr/0076-popovers-in-pages-embed-an-sdk-anchored-dialog-part.md)
- ADR 0077: [Open-point rows become clickable after the MVP](../../../apps/ethlete-studio/docs/adr/0077-open-point-rows-become-clickable-after-the-mvp.md)
- ADR 0078: [The SDK select part gets label and options props](../../../apps/ethlete-studio/docs/adr/0078-the-sdk-select-part-gets-label-and-options-props.md)
- ADR 0079: [The sketches round picker stays the plain small SDK select](../../../apps/ethlete-studio/docs/adr/0079-the-sketches-round-picker-stays-the-plain-small-sdk-select.md)
- ADR 0080: [Inventory controls are keyed on DOM path plus label](../../../apps/ethlete-studio/docs/adr/0080-inventory-controls-are-keyed-on-dom-path-plus-label.md)
- ADR 0081: [The Inventory view becomes a canvas after the MVP](../../../apps/ethlete-studio/docs/adr/0081-the-inventory-view-becomes-a-canvas-after-the-mvp.md)
- ADR 0082: [The Inventory view respects the frame viewport](../../../apps/ethlete-studio/docs/adr/0082-the-inventory-view-respects-the-frame-viewport.md)
- ADR 0083: [The Inventory gets an Assets section](../../../apps/ethlete-studio/docs/adr/0083-the-inventory-gets-an-assets-section.md)
- ADR 0084: [Rail items are plain buttons, not SDK button parts](../../../apps/ethlete-studio/docs/adr/0084-rail-items-are-plain-buttons-not-sdk-button-parts.md)
- In progress (builder 57, 2026-10-31): parallel subagents on shell-main b round + Q234, Q228 anchored-dialog part, pages/merge Changed rows, Q224 inventory part + view coverage + `design check --part`, Q227 size budget + token report, Studio app round picker onto et-select.
- ADR 0085: [The sketch view renders one round at a time](../../../apps/ethlete-studio/docs/adr/0085-the-sketch-view-renders-one-round-at-a-time.md)
- ADR 0086: [A fully covered control is listed but not outlined](../../../apps/ethlete-studio/docs/adr/0086-a-fully-covered-control-is-listed-but-not-outlined.md)
- ADR 0087: [The anchored-dialog part has a content slot](../../../apps/ethlete-studio/docs/adr/0087-the-anchored-dialog-part-has-a-content-slot.md)
- ADR 0088: [The filter demo Apply is the SDK button; the checkbox stays native](../../../apps/ethlete-studio/docs/adr/0088-the-filter-demo-apply-is-the-sdk-button-the-checkbox-stays-native.md)
- ADR 0089: [The inventory lists every open overlay](../../../apps/ethlete-studio/docs/adr/0089-the-inventory-lists-every-open-overlay.md)
- ADR 0090: [pages/inventory is merged for the MVP and reworked after](../../../apps/ethlete-studio/docs/adr/0090-pages-inventory-is-merged-for-the-mvp-and-reworked-after.md)
- ADR 0091: [A multi-instance control is covered only when every instance is](../../../apps/ethlete-studio/docs/adr/0091-a-multi-instance-control-is-covered-only-when-every-instance-is.md)
- ADR 0092: [The Inventory rework starts from the designer](../../../apps/ethlete-studio/docs/adr/0092-the-inventory-rework-starts-from-the-designer.md)
- ADR 0093: [A demo frame belongs only to a part's own states](../../../apps/ethlete-studio/docs/adr/0093-a-demo-frame-belongs-only-to-a-parts-own-states.md)
- ADR 0094: [Contrast failures are fixed where the colour lives](../../../apps/ethlete-studio/docs/adr/0094-contrast-failures-are-fixed-where-the-colour-lives.md)
- ADR 0095: [sketch ready blocks only on issues the sketch adds](../../../apps/ethlete-studio/docs/adr/0095-sketch-ready-blocks-only-on-issues-the-sketch-adds.md)
- ADR 0096: [Every visible grid cell looks the same](../../../apps/ethlete-studio/docs/adr/0096-every-visible-grid-cell-looks-the-same.md)
- ADR 0097: [The changed area keeps its interaction neighbourhood](../../../apps/ethlete-studio/docs/adr/0097-the-changed-area-keeps-its-interaction-neighbourhood.md)
- ADR 0098: [Filled active mixes 96% primary with on-primary](../../../apps/ethlete-studio/docs/adr/0098-filled-active-mixes-96-primary-with-on-primary.md)
- ADR 0099: [A multi-part sketch head shows the round title](../../../apps/ethlete-studio/docs/adr/0099-a-multi-part-sketch-head-shows-the-round-title.md)
- ADR 0100: [The filled-active pick also goes into icon-button and split-button](../../../apps/ethlete-studio/docs/adr/0100-the-filled-active-pick-also-goes-into-icon-button-and-split-button.md)
- **floating-action frame (2026-11-01), after the MVP, open:** the Q241 round left `components/floating-action` out.
  Its demo frame is two elements (`fa-frame > fa-page`), and the Q243 path normalisation assumes a one-element frame,
  so an old CONTROL-PART-INPUT issue looks new. Options: teach the normalisation multi-element frames, or keep
  `fa-page` in render. Recommendation: teach the normalisation, so every part follows the same frame rule.
- ADR 0101: [Inbox comment rows are declared controls](../../../apps/ethlete-studio/docs/adr/0101-inbox-comment-rows-are-declared-controls.md)
- ADR 0102: [MVP go for every open Studio part](../../../apps/ethlete-studio/docs/adr/0102-mvp-go-for-every-open-studio-part.md)
- ADR 0103: [Rename "go" after the MVP](../../../apps/ethlete-studio/docs/adr/0103-rename-go-after-the-mvp.md)
- ADR 0104: [Two designers on one project: grill first](../../../apps/ethlete-studio/docs/adr/0104-two-designers-on-one-project-grill-first.md)
- ADR 0105: [The implements link does not count for the Studio MVP](../../../apps/ethlete-studio/docs/adr/0105-the-implements-link-does-not-count-for-the-studio-mvp.md)
- **Q248 (2026-11-01), after the MVP with the extraction:** `elements/canvas-frames` -> `canvas-frame-grid.component.ts`;
  `studio-view.component.ts` gets `elements/shell-main` as its part. Recommended, not yet confirmed by Tom.
- ADR 0106: [Missing interaction states use the existing styles](../../../apps/ethlete-studio/docs/adr/0106-missing-interaction-states-use-the-existing-styles.md)
- ADR 0107: [Go in advance for the six linked parts](../../../apps/ethlete-studio/docs/adr/0107-go-in-advance-for-the-six-linked-parts.md)
- ADR 0108: [Sketches that will auto-merge get a visible mark](../../../apps/ethlete-studio/docs/adr/0108-sketches-that-will-auto-merge-get-a-visible-mark.md)
- **System lessons from the MVP push (Tom, 2026-11-01), after the MVP:** Tom wants the system fixed so that these
  cannot happen again. Findings from 2026-10-31/11-01:
  - Plain `design check` hid missing states and contrast findings that only `design ready` draws; one measure must
    show every blocker.
  - Button colours live twice: in the SDK design part (`.ethlete/design/sdk/components/button`) and in
    `libs/components`. A sketch merge changed one, the lib port the other, and Studio still drew the old colour.
  - The design renderer loads `@ethlete/*` from `dist/libs` and never says when that build is older than the lib
    sources: the canvas-frames "Save" contrast finding (3.81:1) came from a `dist/libs/components` built before the
    lib fix 7385e470f. `design check` and `design ready` should warn on a stale dist. The part's filled-active rule
    also lacks the lib's `:not([disabled],[aria-disabled='true'])`, one more case of the button colours living twice.
  - Studio has separate "Pick a" and "Merge a" buttons; a pick only writes `decision` into sketch.json, so the
    shell-project-option pick sat unmerged with no sign (applied by hand in d4c238ec0). Until Studio shows "picked,
    not merged" (or one action does both), the builder runs `sketch list` each turn and merges every picked sketch.
  - Forced interactions (hover, active) were applied to disabled states ("disabled-active").
  - A design server started before a `@ethlete/cli` update kept the old routes; Studio showed "has no system view"
    instead of "restart the server".
  - Studio wrote `inventory.json` in a format Prettier rejects, which broke the next push.
  - Browser-backed cli specs were skipped in CI without a signal.
  - render-check compared only one rule with the merged part, so old issues blocked unrelated sketches.
  - A multi-part sketch shows only its first target as its title (Q244).
  - The go exists only in the CLI; an agent cannot give it for Tom, and Studio has no action for it.
  - App views build parts inline that should be their own components (tree-row, part-tree, zoom-chip, comment-pin,
    canvas-viewport, the merge view; Q247), and some designed parts have no app code at all. The system must make a
    part map to one component from the start, so a design part and its implementation cannot drift apart.
  - Glued and interpolated class strings landed in many parts and needed cleanup rounds (Q221, and a new
    CLASS-GLUED-INTERPOLATION after a merge); the check should stop them when a part is written, not after.
  - Pages fought embedded demo frames with Tailwind `!` overrides (Q241); parts should not be able to use `!`.
  - Detection rules were too narrow at first: unused base parts counted only ES imports (Q218); STALE-REPLACE did not
    follow a conditional receiver; the Q243 path normalisation assumes a one-element frame (floating-action).
  - Test fixtures broke on a new import without a signal (frame-bootstrap stub), and a spec hit the 5 s limit only
    on the CI runner.
  - The tomflix design server and the docs-examples app both use port 4403 (`.ethlete/design/config.json`,
    `apps/docs-examples`); the default ports must not collide.
- **Studio MVP reached (2026-11-01):** `design check --product studio --complete` reports 26 of 26 Studio parts
  clean after the Q249 merges, the checkbox and radio-group d merge (e855918d4) and the embedded-control checker fix
  (e0bf58dca). Left on purpose, after the MVP: the 8 UNLINKED parts and `studio-view.component.ts` without a part
  (Q247, Q248), the 48 SDK parts with open points, the lib port of checkbox and radio-group d, and every parked item
  above.
- **Checkbox missing states (2026-11-01), with the checkbox and radio-group SDK track:** the merged variant d of sdk
  `components/checkbox` lacks 4 states (option.disabled, select-all.hover, select-all.active, select-all.disabled).
  One sketch round after the Studio implementation phase, before the lib port.
- ADR 0109: [The canonical-class check runs on Studio app templates](../../../apps/ethlete-studio/docs/adr/0109-the-canonical-class-check-runs-on-studio-app-templates.md)
- ADR 0110: [Studio app code: zero lint warnings, no inline SVGs, no inline components](../../../apps/ethlete-studio/docs/adr/0110-studio-app-code-zero-lint-warnings-no-inline-svgs-no-inline-components.md)
- ADR 0111: [Multi-user identity and old-panel states come after the MVP](../../../apps/ethlete-studio/docs/adr/0111-multi-user-identity-and-old-panel-states-come-after-the-mvp.md)
- ADR 0112: [The inbox load-error state shows the real message](../../../apps/ethlete-studio/docs/adr/0112-the-inbox-load-error-state-shows-the-real-message.md)
- ADR 0113: [The go hash ignores the implements link](../../../apps/ethlete-studio/docs/adr/0113-the-go-hash-ignores-the-implements-link.md)
- ADR 0114: [The design harness emits the classes the designs use](../../../apps/ethlete-studio/docs/adr/0114-the-design-harness-emits-the-classes-the-designs-use.md)
- ADR 0115: [One shared compare rule for SDK pane corner antialias](../../../apps/ethlete-studio/docs/adr/0115-one-shared-compare-rule-for-sdk-pane-corner-antialias.md)
- ADR 0116: [Reject, reopen, notes and diff lists: decide in Tom's round](../../../apps/ethlete-studio/docs/adr/0116-reject-reopen-notes-and-diff-lists-decide-in-toms-round.md)
- ADR 0117: [Part-tree section levels and multi-frame rows after the MVP](../../../apps/ethlete-studio/docs/adr/0117-part-tree-section-levels-and-multi-frame-rows-after-the-mvp.md)
- For Tom's round (2026-11-01): the side tree no longer shows sketch status and comment counts (Impl Q39/Q43); the
  problem text shows only as the warning's title.
- ADR 0118: [Flow canvas extras, a discard confirm and merge rows after the MVP](../../../apps/ethlete-studio/docs/adr/0118-flow-canvas-extras-a-discard-confirm-and-merge-rows-after-the-mvp.md)
- ADR 0119: [A per-preset frame box ratio on the flows canvas](../../../apps/ethlete-studio/docs/adr/0119-a-per-preset-frame-box-ratio-on-the-flows-canvas.md)
- ADR 0120: [Removed live-page pieces come back only with a design](../../../apps/ethlete-studio/docs/adr/0120-removed-live-page-pieces-come-back-only-with-a-design.md)
- ADR 0121: [The studio menu targets each need a design](../../../apps/ethlete-studio/docs/adr/0121-the-studio-menu-targets-each-need-a-design.md)
- ADR 0122: [Server status, scan, update hint and exceptions popover need plans](../../../apps/ethlete-studio/docs/adr/0122-server-status-scan-update-hint-and-exceptions-popover-need-plans.md)
- ADR 0123: [Inventory entry and the All products button need a design](../../../apps/ethlete-studio/docs/adr/0123-inventory-entry-and-the-all-products-button-need-a-design.md)
- ADR 0124: [import/no-cycle for libs/components](../../../apps/ethlete-studio/docs/adr/0124-import-no-cycle-for-libs-components.md)
