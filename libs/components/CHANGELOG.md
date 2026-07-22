# Changelog

## 1.0.0-next.29

### Patch Changes

- [`90dad92`](https://github.com/ethlete-io/ethdk/commit/90dad922e8985b76e5f5ad67727333de6f5b9431) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays now elevate one level above the surface their **trigger** actually sits on, resolved from the trigger's nearest surface ancestor in the DOM rather than from dependency injection. The overlay container previously read its parent surface from the injector context (`SURFACE_PROVIDER`), which is wrong across the portal boundary: an overlay's trigger keeps the injector of where it was _declared_, and the anchored panel overlays (select, cascader, date-picker, menu) mount with no DI link to the trigger at all — so they always landed at elevation 1.

  This fixes two cases:

  - A `select` (or any anchored panel) opened from **inside a dialog** now mounts at elevation 2 instead of matching the dialog's elevation 1.
  - A picker anchored to a field inside an **elevated card** (e.g. a date input in a card at elevation 1) now elevates above the card instead of staying at elevation 1.

  Nested content (submenus elevating above their parent menu) and the plain non-nested case (an overlay opened from the base page mounts at elevation 1) are unchanged. Modal dialogs still always mount at elevation 1 — a backdrop resets the visual context.

## 1.0.0-next.28

### Minor Changes

- [`b9fd6c2`](https://github.com/ethlete-io/ethdk/commit/b9fd6c2cc9dfac8211b33c4eed7039538257c2ef) Thanks [@TomTomB](https://github.com/TomTomB)! - Rename the module import arrays to SCREAMING_SNAKE_CASE for consistency with the rest of the library: `StreamImports` → `STREAM_IMPORTS`, `TabImports` → `TAB_IMPORTS`, `NavTabImports` → `NAV_TAB_IMPORTS` and `GridImports` → `GRID_IMPORTS`. Update your `imports` arrays accordingly.

- [#3034](https://github.com/ethlete-io/ethdk/pull/3034) [`deccbdd`](https://github.com/ethlete-io/ethdk/commit/deccbdda82d0df9984cdcdac1ab3485d7e080759) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: give the boxed overlay kinds (`dialog`, `anchoredDialog`, the four sheets and the full-screen dialog) a default themed pane surface — `--et-surface-background-solid` background, a `0.1rem` `--et-surface-border-solid` border (all around for dialogs; every edge but the docked one for bottom/top sheets; only the exposed inner edge for side sheets, whose block edges sit flush against the viewport), and a radius on the exposed corners (`1.6rem` dialogs/sheets, `1.2rem` anchored dialog; full-screen stays square). Plain overlay content no longer needs to paint its own surface. Overridable per instance via the new `--et-overlay-surface-background`, `--et-overlay-surface-color`, `--et-overlay-surface-border-color`, `--et-overlay-surface-border-width` and `--et-overlay-radius` tokens. Anchored/centered panes (menu, tooltip, select, date-picker) are unaffected — they still paint their own surface.

## 1.0.0-next.27

### Major Changes

- [`6f4b966`](https://github.com/ethlete-io/ethdk/commit/6f4b966c4dc0244b9dfc40978f42362fe9c89a58) Thanks [@TomTomB](https://github.com/TomTomB)! - - Cascader: renamed the `opened`/`closed` outputs to `afterOpen`/`afterClose`.
  - OTP input: renamed the `completed` output to `complete`.
  - Boolean inputs on select, cascader, selection-list, selection-option, select-option, menu item, menu selection group, switch, text-field controls, number input and scrollable now accept static attributes (e.g. `<et-select multiple>`, `renderMasks="false"`) via a `booleanAttribute` transform.

### Patch Changes

- [`ed58b19`](https://github.com/ethlete-io/ethdk/commit/ed58b19b1957f2051e0f1ef68c3814747af9ccd0) Thanks [@TomTomB](https://github.com/TomTomB)! - `etAutoSurface`: opening an overlay (date-picker, select, menu, …) no longer elevates unrelated surfaces on the base page. The overlay surface-context tracker is now matched by DOM containment, so an `etAutoSurface` only adopts an overlay's elevation when it actually renders inside that overlay's pane.

## 1.0.0-next.26

### Patch Changes

- [`13e41b0`](https://github.com/ethlete-io/ethdk/commit/13e41b04c48ccfc0f171e0693c7662435565b490) Thanks [@TomTomB](https://github.com/TomTomB)! - Drop the unused `DescriptionComponent` import from the checkbox-option and radio components (both only project `et-description` via `<ng-content>`), clearing the NG8113 unused-import build warnings.

## 1.0.0-next.25

### Minor Changes

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`08ccfb4`](https://github.com/ethlete-io/ethdk/commit/08ccfb406db0269237ce3d026036c3400dff01d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `createV2DropzoneUpload` — a legacy `V2QueryClient` flavor of the dropzone `upload` config, mirroring `createDropzoneUpload`. Apps that haven't migrated to the new `@ethlete/query` API can now drive the dropzone from a legacy v2 creator (`client.post(...)` or a `createLegacyQueryCreator` interop wrapper); it slots into the same `upload` input and supports the full lifecycle (progress, success, failure, retry, existing values). Internally the per-file query lifecycle now runs behind an upload-handle abstraction, so both flavors share the directive/entry code and the failure display handles both `QueryErrorResponse` and `RequestError`.

- [`edb1f14`](https://github.com/ethlete-io/ethdk/commit/edb1f146792c308a0b80e8108d48934369d27b1d) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: the label is now truly optional — the label-mode layouts (`static`,
  `floating-outside`) no longer reserve the label band when no `<et-label>` is
  projected.
  - Text-field controls (`et-input`, `et-number-input`, `et-password-input`,
    `et-color-input`, `et-textarea`) now accept `aria-label` / `aria-labelledby`,
    forwarded onto the native control; a consumer `aria-labelledby` overrides the
    projected `<et-label>`.
  - In dev mode a form field whose control has no accessible name — no `<et-label>`
    and no `aria-label`/`aria-labelledby` — now throws (`ET2201`). A placeholder is
    not an accessible name.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`0ecb9db`](https://github.com/ethlete-io/ethdk/commit/0ecb9dbe116b566beab61391b2cb92f3439c07f6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: public API to insert a token chip at the caret from your own UI.
  - `RichTextEditorDirective.insertToken(type, id, opts?)` inserts a `{{type:id}}` token chip at the
    caret (or the end when unfocused), resolving its label via the trigger's `resolveItem` — the same
    result as picking it from the `#`/`@` popup. `insertTokenItem(type, item, opts?)` does the same
    when you already hold the resolved `{ id, label }`. The directive now also exports as
    `etRichTextEditor`.
  - New opt-in `et-rich-text-editor-token-palette` component (via `RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS`):
    a click-to-insert chip row driven by the same `RichTextEditorTrigger[]`.

- [#3029](https://github.com/ethlete-io/ethdk/pull/3029) [`129c3c9`](https://github.com/ethlete-io/ethdk/commit/129c3c97c8b2e62fd4532ba03e7cf9bf6aaee764) Thanks [@EliasPapavlassopoulos](https://github.com/EliasPapavlassopoulos)! - Add a two-way `mixed` bulk-edit state (plus `mixedLabel` where the control has a text display slot) across the form controls: select (single, multi, searchable, headless, virtualized), cascader, input, number-input, password-input, textarea, color-input, date-input, time-input, date-time-input, date-range-input, duration-input, tag-input, phone-input, slider, range-slider, rating, and the selection-list groups (radio, checkbox-group, segmented). While `mixed` is set the raw form value stays untouched and masked; the first user commit replaces it and resolves the state. All implementations follow one executable contract (shared conformance suite); checkbox keeps expressing the concept via its platform-named `indeterminate`, and switch deliberately stays two-state (ARIA forbids a mixed switch).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b5c0207`](https://github.com/ethlete-io/ethdk/commit/b5c0207db2af40b15f8575e3f6c721d07cf81b2f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select` (and the headless `[etSelect]`) gains the `[etSelectOptions]` directive: bind the bundle returned by `selectOptionsFromQuery` or `selectOptionsFromV2Query` with a single attribute and it wires the async plumbing for you — forwarding `loading`, `error` and `hasMoreItems`, forcing `filterMode` to `external`, and driving the bundle's `setQuery`/`loadMore` from the select's `(queryChange)`/`(loadMore)` outputs. You only render the options. Both factories return the same shape, so one directive serves the current query client and the legacy `V2QueryClient` alike. The manual per-input wiring stays fully supported.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`5fc9aa4`](https://github.com/ethlete-io/ethdk/commit/5fc9aa4316390c2db908c6dcd3c2118945a11089) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select` (and the headless `[etSelect]`) gains an `pickOption` output and a `pickOnly` input. `pickOption` emits the picked value whenever a single-select option is committed — a "the user actively picked this" signal distinct from `valueChange`. With `pickOnly`, committing an option emits `pickOption` without ever writing `value`, so the select stays empty: a fire-and-forget "add" picker that feeds an external list without the set-then-clear dance (and its race with the `[(value)]` write-back). `pickOnly` has no effect in multi-select.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`6605423`](https://github.com/ethlete-io/ethdk/commit/6605423235364f06c07e827205de2c3a351a538f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Switch now supports an `indeterminate` state (two-way `[(indeterminate)]`), mirroring checkbox — the first toggle resolves it to on. Since `role="switch"` cannot carry `aria-checked="mixed"`, it's presentational only (thumb parks mid-track behind `data-indeterminate`; `aria-checked` stays boolean). The mixed/indeterminate state on the graphical controls (rating, slider, range-slider, checkbox-group, radio-group, switch) now uses a consistent dashed "provisional" treatment so it reads as "values differ" rather than empty.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`d738771`](https://github.com/ethlete-io/ethdk/commit/d738771a05b4505616defab52359870892bae171) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `createOverlayUnsavedChangesGuard` — the overlay flavor of the `unsavedChanges` family. Called from an overlay content component's injection context, it injects the current `OVERLAY_REF` and vetoes a dismissal (outside pointer, escape, drag, or a programmatic `close()`) while the watched form has unsaved changes, runs the `confirm`, and only then re-issues the close. Per-source opt-out via `dismissSources`, honors `disableClose`, and auto-cleans up on injector destroy.

  Also exposes the underlying close-veto seam on `OverlayRef`: `registerCloseGuard(guard)` and `forceClose(source?, result?)`.

### Patch Changes

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b5b037e`](https://github.com/ethlete-io/ethdk/commit/b5b037e6e4e1c1d1ecef9c4c13edab01e40a1d0f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix anchored panels (`select`, `cascader`, the date/time pickers) closing when a popover opened from inside them is clicked. A nested overlay (a select body, menu or tooltip) mounts as a sibling pane in the overlay root, not a DOM descendant, so the panel's outside-pointer check treated a click in the child as an outside dismissal and closed itself. The check now resolves the whole nested overlay tree — anchored by each pane's `origin` — so a pointerdown anywhere inside a descendant popover no longer dismisses the panel that opened it.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`4d70fb1`](https://github.com/ethlete-io/ethdk/commit/4d70fb1fd173e7e9d25031551f752196abb6f94e) Thanks [@github-actions](https://github.com/apps/github-actions)! - `etAutoSurface` now elevates correctly for content rendered inside an overlay. Projected/portaled content keeps the injector of where it was _declared_ (the trigger location), not the pane it renders into, so an `etAutoSurface` inside a select body, menu, date-picker, etc. resolved its parent surface from the outer trigger context and came out one elevation too low — the same level as the overlay's own panel instead of one above it.

  `AutoSurfaceDirective` now also consults the root surface-context tracker (which records the innermost open overlay's surface across the portal boundary) and takes whichever parent surface sits higher. Overlay panels that are themselves the overlay's surface (menu, select/date/cascader panels, tooltip, toggletip) opt out via the new `AutoSurfaceDirective.ignoreOverlaySurfaceContext()` so they keep adopting their overlay's elevation rather than stacking above it — their rendered surface is unchanged.

- [`995eab1`](https://github.com/ethlete-io/ethdk/commit/995eab158002c0e36779cbd54dbbaf7da9355f58) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: clear ("×") buttons now fade in/out (opacity only) instead of appearing abruptly, consistently across date, time, date-time, duration, phone, select, and cascader. Respects `prefers-reduced-motion`. `et-date-range-input` gains the same clear button (new `clearable`/`clearLabel` inputs).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`43e8711`](https://github.com/ethlete-io/ethdk/commit/43e8711f49ca995a4fdb95d95359219bd8298407) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form fields now keep their focused styling (accent border, lit label/affix) while a control's popup is open. Opening a date/time/date-range picker, select or cascader panel moves focus into the detached overlay, so `:focus-visible` no longer matched the field and it visibly dropped back to its resting look — controls now report an `expanded` state the field reflects as `[data-expanded]`.

  Also fixes a flicker on the date-picker trigger button: clicking it while the field was focused briefly blurred the input (hiding the clear button and dropping the focused style) one frame before the picker opened. The trigger now prevents the mousedown default, matching the clear button, so focus stays on the field through the toggle.

- [`246bb5e`](https://github.com/ethlete-io/ethdk/commit/246bb5ee26d6c28adacea316426a5af19b248a17) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: text-field controls (`et-input`, `et-number-input`,
  `et-password-input`, `et-textarea`) no longer render an empty `autocomplete=""`
  attribute when no autocomplete is set — the attribute is now omitted, clearing
  Chrome's "Incorrect use of autocomplete attribute" warning.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b712197`](https://github.com/ethlete-io/ethdk/commit/b712197005495bc180e86d9645f77032da9fb266) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date/time/date-range pickers, select and cascader now flip their alignment on the same side before flipping vertically: their anchored fallback placements changed from `['top-start']` to `['bottom-end', 'top-start', 'top-end']`. A field near the right viewport edge now opens right-aligned under the field (`bottom-end`) instead of being cross-axis shifted, matching the fallback behaviour menus already use.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`62dbf77`](https://github.com/ethlete-io/ethdk/commit/62dbf77444238841fcd22a1c39467fd7f577d707) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor content no longer retints when the editor gains focus. The field frame is an `et-color-interactive--has-focus` ancestor that re-resolves the accent tokens on focus, and rendered content reading the accent — token chips (their outline and fill), links and the caret — inherited that shift. The content root now re-anchors the accent tokens to their resting value, insulating it from the field's interaction state (the same immunity the interactive toolbar buttons already have from carrying `et-color-interactive`).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`5fc9aa4`](https://github.com/ethlete-io/ethdk/commit/5fc9aa4316390c2db908c6dcd3c2118945a11089) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select`: a searchable single select with a custom value template (`etSelectValue`) now swaps the rich display for the option's editable plain-text label inside the search input while the field is focused (edit mode), and restores the rich template on blur. Keyboard editing is now at parity with a plain searchable single select — the label is selected on open, Backspace edits the visible text, and erasing it clears the selection. Previously the input stayed empty in this case, so a single Backspace silently deleted the whole selected value with nothing visible to edit.

- [`139d734`](https://github.com/ethlete-io/ethdk/commit/139d73474ec710834a28df50160c2cce1e795c1c) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: trigger-based controls (select, date pickers) keep their focused frame after a pointer-driven commit, so the frame and the clear affordance no longer disagree about whether the field is focused.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b7a6582`](https://github.com/ethlete-io/ethdk/commit/b7a6582b0b4753c551617de8282a43df841847d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select panel: a width-mirrored panel now matches its field at any width. The panel carried a `max-inline-size: 400px` cap, so on fields wider than 400px the dropdown stopped matching the trigger and rendered narrower than the field. The cap is now scoped to compact triggers (`mirrorPanelWidth={false}`), where the pane is content-sized and still needs an upper bound; when the panel mirrors the field the pane width alone sizes it, with no cap.

## 1.0.0-next.24

### Major Changes

- [#3028](https://github.com/ethlete-io/ethdk/pull/3028) [`d2b47d7`](https://github.com/ethlete-io/ethdk/commit/d2b47d7b0017f957ba4bb442e421c017973a11b3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select: renamed the outputs `loadMoreRequested` → `loadMore` and `addNewRequested` → `addNew` (present-tense event names). Update your `(loadMoreRequested)` / `(addNewRequested)` bindings accordingly.

  `selectOptionsFromQuery` and `selectOptionsFromV2Query` now handle load-more paging internally: `args` receives a `page` signal (starting at `initialPage`, default `1`) that resets on query change, the returned bundle exposes `loadMore()` to wire to `(loadMore)`, and each page's `toOptions` slice is appended to the accumulated `options`.

### Patch Changes

- [#3028](https://github.com/ethlete-io/ethdk/pull/3028) [`d8f50c5`](https://github.com/ethlete-io/ethdk/commit/d8f50c530b976390a8e655f3b1a4c0b9eaaae6ab) Thanks [@github-actions](https://github.com/apps/github-actions)! - Hover styles across all interactive components (buttons, chips, form controls, selects, cascader, menu, tabs, calendar, time picker, notification) no longer stick after tapping on touch devices — including the `etColorInteractive`/`etSurfaceInteractive` hover token resolution (guarded by `@media (hover: hover)`).

## 1.0.0-next.23

### Minor Changes

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: flat search across all levels. Implement the optional `search(query)` hook on the `CascaderDataSource` (returning root → match path chains) and the panel gains a search input that swaps the columns for a flat, breadcrumb-labelled result list — committing a match closes, while a branch-only match jumps the columns to it. New headless pieces `etCascaderSearch` and `etCascaderSearchOption`; `et-cascader` renders the input automatically (`searchPlaceholder` input) and Escape now clears an active query before closing the panel.

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: `cascaderFromQuery` builds a `CascaderDataSource` from `@ethlete/query` creators — per-level loads (concurrent, deduped/cached by the client), optional flat-search wiring with debounce and `minQueryLength`, and a `resolvePath` passthrough. The cascader's default `toErrorMessage` now shows an `Error`'s `message` verbatim (falling back to the generic text), so query failure messages surface without extra wiring.

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: multi-select via the new `multiple` input — activations toggle values (the form value becomes a `T[]`), the panel stays open, rows gain check squares, ancestors of a partial selection show an indeterminate dash and promote to a full checkmark once all their loaded descendants are selected. Search results toggle in place (keeping the result list), the trigger joins the selected labels, and programmatic values resolve their chains through `resolvePath`. The `value` model is now typed `T | T[] | null`.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: new `et-cascader` / `[etCascader]` (`CASCADER_IMPORTS`) — a generic hierarchy value control that browses an abstract `CascaderDataSource<T>` level by level (sync array, `Promise` or `Observable`, each level lazy-loaded). Miller columns on desktop, single-column drill in a bottom sheet on mobile; `selectableLevels` (`'leaf'` | `'any'`), `path`/`pathValue` chain, per-column loading/empty/error states with retry, full ARIA tree keyboard navigation, and signal-forms integration. Error block `ET3300`–`ET3399`.

  Deep hierarchies stay compact: the desktop panel shows at most `maxVisibleColumns` (default 3) columns side by side, showing the whole drilled trail as a breadcrumb row below the columns once it overflows. All drilled levels ride a sliding track, so collapsing into a crumb (and navigating back out of one) is a coordinated slide rather than a pop. Navigating back is non-destructive — a crumb click or Arrow Left past the window edge slides the column window without discarding the deeper drill. Headless: `visibleColumns()`, `breadcrumbPath()`, `visibleColumnStart()`, `showColumn()`.

- [#3027](https://github.com/ethlete-io/ethdk/pull/3027) [`0a62001`](https://github.com/ethlete-io/ethdk/commit/0a6200181b706828bc8b228afb0743a269bd7e8e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: add `et-date-time-input` (+ headless `[etDateTimeInput]`), a combined date & time control with a string wire value — one field with a combined display format (strict-then-lenient typed entry, bare dates commit at midnight) and a picker overlay hosting calendar and time picker side by side (Date/Time tabs in the bottom sheet). A first day pick in the picker also commits at midnight — never the current wall-clock time.

- [`8bfe3ed`](https://github.com/ethlete-io/ethdk/commit/8bfe3ed805a760f13a5cef11125473b1342d747c) Thanks [@TomTomB](https://github.com/TomTomB)! - Date, time, date-time and date range inputs: new opt-in `mask` input. With a fixed-width numeric `displayFormat` (`dd.MM.yyyy`, `HH:mm`, …) typing gets guide placeholders (`__.__.____`), auto-inserted separators, paste filtering and a numeric soft keyboard; the lenient blur/Enter commit parsers stay authoritative. Formats a mask can't represent (locale formats like the default `P`/`p`, variable-width or text tokens) are refused with a dev-mode warning and typing stays unmasked. On the date range input each side is its own mask host, so the guide follows the focused field. The duration input deliberately gets no mask (unbounded first segment, right-anchored lenient entry). Supporting API: `[etInputMask]` now accepts `null` to disable the mask conditionally, and `InputMaskHost` grew an optional `resumeNativeSync()` for hosts whose mask can toggle off again.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Duration input: new `et-duration-input` / `[etDurationInput]` (`DURATION_INPUT_IMPORTS`) — a duration control whose value is total elapsed **milliseconds** (`number | null`), kept out of the `Date` system. Configurable segment layout (`durationFormat`, e.g. `mm:ss`, `hh:mm:ss`, `hh:mm:ss.SSS`) with a lenient typed parse (`130` → `1:30`) committing on blur/Enter. Error code `ET3050` inside the shared date-time block.

- [`4c6b6d0`](https://github.com/ethlete-io/ethdk/commit/4c6b6d000ba568d73c8b191c52fed3206b6a00a6) Thanks [@TomTomB](https://github.com/TomTomB)! - Chip: filter-chip support — `etSelectionList` + `etSelectionOption` compose directly onto `et-chip` for selectable chip groups (single or multiple), with a color-theme tonal selected state and hover/focus affordances. Selection options now tolerate late-bound `value` inputs (directive compositions no longer throw NG0950).

- [`04ffa53`](https://github.com/ethlete-io/ethdk/commit/04ffa53bf3b65977bd4f87d312781faa93057d1f) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: fix bugs and accessibility issues across the form controls, and add a few
  opt-in APIs.
  - **Fixes:** select-all no longer sticks on "mixed" when a disabled option is
    present; a cascader value set programmatically now shows its breadcrumb (via a
    new optional `resolvePath` on the cascader data source); typed date/time/range
    values no longer leak the current wall-clock time; duration/date/time null the
    value on an unparseable commit; masked inputs no longer break IME composition;
    standalone `input[etInput]` now syncs on keystroke; number steppers mark the
    field touched and can't leak their auto-repeat timer; OTP re-emits `completed`
    when a full code is replaced; color inputs honor `[readonly]`.
  - **Accessibility:** multi-select options and the select-all control now use
    `role="checkbox"` (not `option`); a parse error is announced with a real
    message and `aria-describedby`; the date picker panel is a named
    `role="dialog"`; the cascader trigger's `aria-controls` resolves; select
    panels keep only options inside the listbox; the phone country trigger and
    cascader columns gained accessible names/typeahead; a schema-`hidden` field is
    now actually hidden; Caps-Lock detection also samples on focus.
  - **New inputs:** `parseErrorMessage` (date/time/date-time/duration/range),
    password `hideLabel`, phone `countryLabel`, date-picker-panel `dialogLabel`.
  - **Note:** the checkbox now toggles on `keydown` Space (matching switch and the
    selection options), and the select panel renders its listbox as an inner
    element — restyle if you targeted the panel host as the listbox.

- [`888ce8a`](https://github.com/ethlete-io/ethdk/commit/888ce8a504c7001f2fb50ae83302483d7148486a) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms consistency: `readonly` and one-click clearing across more controls.
  - Checkbox, switch and the three selection-list groups now honor `readonly` (e.g. from a `readonly(...)` schema): normal look, still focusable (`aria-readonly`), toggling/selecting blocked — arrows in a readonly radio group move focus without selecting.
  - Date, time, date-time, duration and phone inputs render a clear (×) button while the focused field holds a value (`clearable`, default on; label via `clearLabel`), backed by a public `clearValue()` on their headless directives.

- [`85d7332`](https://github.com/ethlete-io/ethdk/commit/85d73327be9a5fc2154c5a0f0f2defe25e657a55) Thanks [@TomTomB](https://github.com/TomTomB)! - Masked input: the mask now attaches through a public `INPUT_MASK_HOST` contract (provided by `et-input` out of the box), so custom field directives can host `[etInputMask]` too. Pattern masks additionally expose `complete()` on the directive (`0`/`a`/`*` slots required, `9` optional; `null` for masks without completeness) via a new optional `MaskSpec.isComplete`.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Masked input: new `[etInputMask]` directive layering input masking onto `et-input` — pattern-string masks (`00-00-0000` style grammar) or `MaskSpec` objects, with `createCurrencyMask` / `createIbanMask` / `createCardMask` factories, raw-or-masked form values (`maskValueMode`, raw by default), focused-state guide placeholders (`placeholderChar`) and full caret handling (`MASKED_INPUT_IMPORTS`).

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Number input: new `stepper` input on `et-number-input` rendering −/+ buttons with press-and-hold auto-repeat, `min`/`max` clamping and bound-aware disabling; the headless `NumberInputDirective` gains `stepBy(direction)` / `canStepUp` / `canStepDown`. Adds the `et-minus` built-in icon.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Password input: new `et-password-input` / `[etPasswordInput]` (`PASSWORD_INPUT_IMPORTS`) — reveal toggle (`revealed` model, `revealable`, `aria-pressed`), opt-in Caps Lock warning (`capsLockWarning`), and a `strength` signal (0–4 typing-feedback heuristic) for composing strength meters. Adds `et-eye` / `et-eye-slash` built-in icons.

- [`36ac99d`](https://github.com/ethlete-io/ethdk/commit/36ac99db8ccf70597d2dda3e845effe4e0687ba9) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: full tag-input ergonomics in custom-value mode (`allowCustomValues`).
  - A "Create …" listbox row (label via `createLabel`) now offers the query as a custom value even while options still match — keyboard-reachable via virtual focus; headless compositions use `customValueCandidate()` + `customValueOption`.
  - New inputs: `customValueSeparators` (characters that commit while typing and split pastes), `commitCustomValueOnClose` (pending text commits on Tab/outside-click close instead of being discarded), `normalizeCustomValue` (map/reject raw text), and `maxSelection` (caps multi selection and locks the search input while full, exposed as `isFull()`; unselected options render disabled while full — deselecting frees them again).
  - `commitCustomValue(raw)` is now public for imperative commits.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `et-select-option-group` / `[etSelectOptionGroup]` for labelled listbox sections. Grouping is presentational — options stay flat for keyboard navigation and typeahead — and a group hides itself once all its options are filtered out under `filterMode="internal"`. `role="group"` + `aria-labelledby`; token `--et-select-option-group-label-font-size`. Error code `ET1009`.

- [`b61ad0f`](https://github.com/ethlete-io/ethdk/commit/b61ad0fbe61ed1b0e7e8cd98e8d673ae91f10ff1) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `selectOptionsFromV2Query` feeds the async select from a legacy `V2QueryClient` query (or a `createLegacyQueryCreator` interop wrapper) — the `V2QueryClient` counterpart of `selectOptionsFromQuery`, returning the same signal bundle.

- [`4f34f1f`](https://github.com/ethlete-io/ethdk/commit/4f34f1fa2ef1809f6b281d52fdc0f037923e88db) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new data-driven `options` input with built-in virtualization for large option lists.
  - `options` takes `SelectOptionData[]` (`{ value, label, disabled? }`) — the select renders the rows itself and windows them, so only the rows near the viewport exist in the DOM (2000 options ≈ 15 rendered nodes). Internal filtering, keyboard navigation, typeahead and closed-panel label resolution work across the full data set.
  - `etSelectOptionTemplate` customizes the row content of data-driven options, with the source entry (extra fields included) as template context.
  - Headless: `etSelectViewport` marks the scroll container to window against, `etSelectVirtualOption` renders one windowed item, and `virtualizedItems()` / `virtualWindow` on `[etSelect]` expose the window state.
  - Breaking for headless consumers of `SelectItem`: `elementRef` is now `element: Signal<HTMLElement | null>` (`null` for a data-driven option outside the rendered window).

- [`a41491d`](https://github.com/ethlete-io/ethdk/commit/a41491db447152e69902020d19bfc30bccf3b01d) Thanks [@TomTomB](https://github.com/TomTomB)! - Server violations → signal-forms bridge:
  - `@ethlete/query`: `mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })` maps an API error's violation list onto a signal form's fields (unmapped violations become form-level errors, violation-free failures degrade to a form-level `etServerError`), plus `extractFormViolations(error)`, `executeUntilSettled(query, executeArgs?)` for awaiting one execution as a settled snapshot, and the `isQueryErrorResponse` guard.
  - `@ethlete/components`: `provideFormErrorMessageResolver(resolver)` lets apps centralize/localize the text `et-form-error` renders by error `kind`; the error's own `message` stays the default.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Slider: new `et-slider` (single value) and `et-range-slider` (`[start, end]` tuple with `minDistance`) form controls, plus the headless `[etSlider]` / `[etRangeSlider]` / `[etSliderTrack]` / `[etSliderThumb]` directives and an `ng-template[etSliderThumbLabel]` value-label slot. Pointer drag with capture, full ARIA slider keyboard model, RTL-aware, signal-forms integrated (`SLIDER_IMPORTS`).

- [`53881a8`](https://github.com/ethlete-io/ethdk/commit/53881a84acf85f094baf50cf73e37fc88ac70461) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: new `wireFormSupport(support, refs)` helper owns the support-region view-child wiring for custom controls built on `injectFormSupport` (the built-in controls now use it).

### Patch Changes

- [`7c16ecf`](https://github.com/ethlete-io/ethdk/commit/7c16ecf4e8b74f228b3734f50146e8e669e61470) Thanks [@TomTomB](https://github.com/TomTomB)! - Calendar and select polish:
  - Calendar: disabled days no longer react to hover, and the hovered endpoint of a range preview renders as a filled circle (like a selected date) instead of a half-filled band capped by a ring.
  - Select: while the panel is open, async loading shows only the panel spinner instead of a second one in the field.

- [`ddb3413`](https://github.com/ethlete-io/ethdk/commit/ddb3413c2673a4f2f513598a208f376b36b7535b) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: dragging (or keyboard-moving) an item downward onto other items now swaps them into the vacated space when they fit, instead of requiring the drag to clear the entire collider before anything repositions.

- [`ddb3413`](https://github.com/ethlete-io/ethdk/commit/ddb3413c2673a4f2f513598a208f376b36b7535b) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid items can now be moved with touch: `[etDragHandle]` sets `touch-action: none` on its host while enabled (the browser was claiming touch pointermoves for scrolling and cancelling the gesture), and read-only grids keep normal touch scrolling.

- [`06377b6`](https://github.com/ethlete-io/ethdk/commit/06377b6312fd32c7d1f497816fa91a655bf72d19) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: a color theme provided on the app root component (e.g. `ProvideColorDirective` via `hostDirectives` plus `forceColor()`) now propagates into overlays even when they are opened without a `viewContainerRef`, and updates reactively while the overlay is open.

- [`f1841b7`](https://github.com/ethlete-io/ethdk/commit/f1841b7ec3a4f6e280c961d072a90fd2ceba75d7) Thanks [@TomTomB](https://github.com/TomTomB)! - Phone input: picking a country prefix now moves focus to the number field instead of back to the prefix toggle (closing the picker with Escape still refocuses the toggle).

- [`57a5104`](https://github.com/ethlete-io/ethdk/commit/57a5104d3805824cf6b28725c5d9aae670af9626) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: rubber-band overscroll (macOS) no longer drags the panel background along with the list, exposing the page behind the overlay — the panel chrome now sits on a non-scrolling element around an inner `.et-select-panel-scroller`.

- [`fa0e118`](https://github.com/ethlete-io/ethdk/commit/fa0e1189f46a5359f5018fba15fbb405af646314) Thanks [@TomTomB](https://github.com/TomTomB)! - Select option checkmarks and menu radio/checkbox item indicators now render on the right (trailing) edge of their row instead of the left, so option labels align flush with the row start. Standalone form controls (checkbox, radio, switch, selection lists, cascader check squares) keep their leading position.

## 1.0.0-next.22

### Minor Changes

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Calendar & date inputs: new date foundation for `@ethlete/components`.
  - `et-calendar` (`CALENDAR_IMPORTS`): inline month calendar on plain `Date`s with single and range selection, `min`/`max`/`dateFilter`, localized labels and the full ARIA-grid keyboard model; headless `[etCalendar]` / `[etCalendarGrid]` / `[etCalendarCell]` for custom markup.
  - `et-date-input` (`DATE_INPUT_IMPORTS`): `string`-valued date field (`valueFormat`, ISO by default) pairing strict typed entry against a locale-aware `displayFormat` with an anchored calendar picker; unparseable text stays visible and raises `parseError` while the value stays `null`.
  - `et-date-range-input` (`DATE_RANGE_INPUT_IMPORTS`): one control with two fields sharing a range-mode picker; value `{ start: string | null; end: string | null }`.
  - New `provideDateFormat` / `provideTimeFormat` / `provideDateLocale` tokens and a `date-fns` (v4) peer dependency.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Chip: new `et-chip` component (pill with optional remove button, Backspace/Delete removal) plus headless `[etChip]` / `[etChipRemove]` directives, exported as `CHIP_IMPORTS`.
  - Selection list: the item registry/selection API moved from the group directive onto its `selection` property (`list.selection.select(...)` instead of `list.select(...)` on the `SELECTION_LIST_TOKEN` contract); group behavior is unchanged.
  - `SelectionListItem` gains optional `id` and `label` signals.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`13fc0af`](https://github.com/ethlete-io/ethdk/commit/13fc0af8d5eabbe6da7461c6fb8507b2e2e0407f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date & time pickers (date, date range, time) open as a backdropped bottom sheet with drag-to-dismiss and touch-sized cells on viewports below the `md` breakpoint; anchored panels are unchanged from `md` up. Interactive controls (buttons, select trigger, calendar cells, time picker options, picker triggers) now set `touch-action` so taps activate without the double-tap-zoom delay on touch devices.
  - Calendar: month navigation slides the new grid in from the travel direction (skipped under `prefers-reduced-motion`); the headless `[etCalendar]` exposes `navigationDirection` and `visibleMonthKey` for custom transitions. In the bottom sheet the calendar reserves the 6-week height so the sheet never resizes.
  - Calendar / time picker: keyboard focus is no longer lost when the focused cell/option is re-created mid-interaction (month crossing, an off-step option leaving the list).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-otp-input` control (`OTP_INPUT_IMPORTS`) — segmented one-time-code/PIN entry backed by a single invisible native input for reliable SMS autofill (`autocomplete="one-time-code"`) and native paste. `length`/`charset` (numeric, alphanumeric or RegExp)/`masked` inputs, a `completed` output per full entry, separator-stripping paste handling, and tokens `--et-otp-input-segment-size/-gap/-radius`. Typed characters pop in and the active segment shows a blinking synthetic caret (both respect `prefers-reduced-motion`).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-rating` control (star rating, `RATING_IMPORTS`) — `FormValueControl<number | null>` implementing the slider pattern: hover preview, drag/swipe rating (mouse and touch, commits on release), half steps (`allowHalf`), click-again/Backspace to clear, arrow-key stepping, and a custom icon slot (`ng-template[etRatingIcon]`). The fill animates as one continuous sweep. Tokens `--et-rating-icon-size` / `--et-rating-gap`.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-tag-input` control (`TAG_INPUT_IMPORTS`) — free-text tags as removable chips with an inline field inside the `et-form-field` shell. Commits on configurable `separators` (Enter/comma by default) and blur, `normalizeTag`/`allowDuplicates`/`maxTags`, Backspace removes the last tag, and pastes split on separators and newlines. For tags with suggestions, compose the select (`multiple` + search + `allowCustomValues`) instead.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: three new form-field controls and a small headless API addition.
  - `et-textarea` (+ headless `TextareaDirective`): multi-line plain-text control with autosize on by default (`rows`, `minRows`, `maxRows`, `resize`).
  - `et-number-input` (+ headless `NumberInputDirective`): numeric input whose form value is `number | null` (empty reads as `null`), with `min`/`max`/`step`; native spin buttons hidden.
  - `et-color-input` (+ headless `ColorInputDirective`): native color picker as a swatch + hex value, form value `'#rrggbb' | null`; tokens `--et-color-input-swatch-size` / `--et-color-input-swatch-radius`.
  - `InputDirective` (and the new input directives) now expose a public `nativeControl` signal referencing the native element, for integrations such as input masking.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`e0b71b1`](https://github.com/ethlete-io/ethdk/commit/e0b71b19a3a14c2c2250d7a217299f7956bb5c3b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `provideIconOverrides()` to swap the built-in `et-*` icons app-wide (or per subtree) — e.g. with your own Font Awesome set. Overrides are keyed by name/variant and merged on top of each component's own `provideIcons()`, so they reach into components that self-register the same name while leaving unlisted icons on their default. The override `name` autocompletes to the built-in set via the new `ET_BUILT_IN_ICON_NAMES` / `EtBuiltInIconName` exports, and any other string still registers a brand-new icon.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`f168303`](https://github.com/ethlete-io/ethdk/commit/f168303bf0a78c559d6733d04c92a1a1c632d42a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: new `et-multi-language-rich-text-editor` — authors the same content in several consumer-defined `languages`, switching between them from a toolbar dropdown that flags which languages are still empty. Its value is a `Record<languageCode, markdown>`, so every translation persists in one form field; bind it with `[formField]` and use the exported `requiredLanguages` validator to require specific translations.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: new `et-phone-input` control (`PHONE_INPUT_IMPORTS`) — tel entry with a searchable country picker built on the select's headless core. Value is normalized `+<dial><national>`.
  - Typing/pasting `+…` (or a `00…` international prefix) re-derives the country by longest dial-code match; manual picks survive shared codes like `+1`, switching countries keeps the national number, and a leading national trunk `0` is stripped (`0171…` → `+49171…`).
  - Digits are grouped for display while unfocused (cosmetic only); the country picker searches names and dial codes, shows an empty state, keeps a fixed panel width, and takes custom flag art via `ng-template[etPhoneInputFlag]`.
  - Zero runtime dependency: ISO + dial codes shipped, names via `Intl.DisplayNames`, emoji flags.
  - The underlying select gained a `mirrorPanelWidth` input (off for compact triggers), with the panel capped at `min(400px, 100vw - 24px)`.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the link flow is now a responsive popover (arrow-anchored on wider screens, a keyboard-pinned top sheet on touch) to edit a link's text and URL, with an open-in-new-tab toggle — replacing the browser `prompt()`. New-tab links persist through the Markdown value as raw HTML (`<a target="_blank" rel="noopener noreferrer">`); ordinary links stay `[text](url)`. `htmlToMarkdown` / `markdownToHtml` in `@ethlete/core` now round-trip `target="_blank"` anchors (sanitized href + forced `rel`). After applying a link the caret moves just past it, with a trailing space added when the link ends the line.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: mobile toolbar and editing fixes.
  - On touch devices the static toolbar docks above the on-screen keyboard while editing (tracked via `visualViewport`, staying pinned as the page scrolls and inside a same-origin iframe) instead of sitting at the top under the platform's selection menu; it fades in only once the editor is active and its menus open without stealing keyboard focus. With a mouse/trackpad it stays at the top as before.
  - The editable area's font size is floored at 16px on touch so iOS Safari no longer zooms the page on focus.
  - Toggling a mark off at the end of a line is no longer undone by the next space.
  - Escape (or the close button) in the link editor returns focus to the editor.
  - Tab/Shift+Tab move between table cells and step the caret out past the first/last cell.
  - `OverlayRef` gained `afterClosedEvent()`, which also reports how the overlay was closed (`escape`, `outside-pointer`, `api`, …).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor:
  - Table tool: the grid-size picker supports touch — drag across the grid to size the table and release to insert; when a table's header row was deleted the menu offers **Insert header row**, and inserting a row from the header now lands in the table body.
  - The link editor and floating toolbar anchor to the selected text (not the full-width block) so the arrow points at the text, and the link editor now opens correctly in an empty editor.
  - The trailing space inserted after atomic tokens (mentions, merge fields) and line-ending links is now a no-break space (Chrome dropped the plain one, gluing the next word); it still serializes as a regular space.
  - Form field: the `inline` label mode now lays out correctly around rich text editors.
  - `RichTextEditorToolDefinition` gains an optional `keydown` hook; table caret navigation now ships with `provideRichTextEditorTableTool` via that hook instead of being bundled into every editor (`editorDom.tableExit` / `tableEnter` are removed) — provide the table tool if your content can contain tables.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1f03013`](https://github.com/ethlete-io/ethdk/commit/1f03013609e8a734788db5b3b7657973fb430b87) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: toolbar accessibility and pressed-state polish.
  - Toolbar buttons that open a menu or popover (heading, alignment, table, link) now show their pressed state while the popover is open.
  - The toolbar is now a single tab stop following the ARIA toolbar pattern: Tab enters it, `ArrowLeft`/`ArrowRight` (plus `Home`/`End`) move focus between buttons, and the next Tab moves on to the editor content.
  - `et-icon-button` now forwards the `emitAriaPressed` input, so `aria-pressed` can be suppressed on pressed-styled buttons that already expose `aria-expanded`.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `et-select` form control — a combobox-pattern trigger opening an anchored, width-mirrored listbox panel (`SELECT_IMPORTS`, plus the headless `[etSelect]` / `[etSelectTrigger]` / `ng-template[etSelectSurface]` / `[etSelectListbox]` / `[etSelectOption]` graph and `et-select-panel` / `et-select-option`). Integrates with `et-form-field` (new `select` control type, all label modes).
  - Single select: full keyboard model — arrows/Home/End move virtual focus via `aria-activedescendant`, Enter/Space commit, typeahead while open, printable keys commit directly while closed; resolves a preselected value's label without ever opening the panel.
  - Multi select (`multiple`): array value, options toggle without closing (`aria-multiselectable`), selection shown as removable `et-chip`s; `deselectOption(...)` and a customizable `ng-template[etSelectValue]`.
  - Search (`input[etSelectSearch]`): inline searchable combobox; `filterMode` `'internal'` (default) or `'external'` (via the `queryChange` output), `allowCustomValues`, and `selectOptionsFromQuery(...)` to feed options from an `@ethlete/query` query (debounce, `minQueryLength`, `toHasMore` pagination).
  - Async state inputs `loading` / `error` / `hasMoreItems` render default panel rows (spinner / alert / load-more via `loadMoreRequested`), each overridable through `ng-template[etSelectLoading]` / `[etSelectError]` / `[etSelectEmpty]`.
  - `allowAddNew` shows an "Add new" row emitting `addNewRequested` with the current query (`addNewLabel`); a `clearable` (×) control clears the value; clicking anywhere on the control frame opens the panel.
  - Options render with `content-visibility: auto` and animated hover so panels with thousands of options stay responsive; the panel animates its block size on content change.
  - `readonly` chips (select and tag input) keep their normal look and drop the remove button; disabled form fields no longer show hover feedback.
  - Form field exposes `controlFrameElement` on its contract so overlay-based controls can anchor their panels to the visible box.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`bd8ec82`](https://github.com/ethlete-io/ethdk/commit/bd8ec8205d080bbfad58760dab13d346159b7a1c) Thanks [@github-actions](https://github.com/apps/github-actions)! - New time controls:
  - `et-time-picker` (+ headless `[etTimePicker]` column/option directives): inline column-list time picker on `Date` values — columns derive from a date-fns format (12/24h, optional seconds, AM/PM), `minuteStep`/`secondStep`, roving-focus listbox columns with wrapping arrows and type-to-jump.
  - `et-time-input` (+ headless `[etTimeInput]`): string-valued form control (`TIME_FORMAT` token, default `HH:mm`) with lenient typed parsing (`930` → 09:30, `9pm`, `9.30`) and an anchored time-picker overlay that stays open across part picks.

### Patch Changes

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`56a38d5`](https://github.com/ethlete-io/ethdk/commit/56a38d5f68c3f4a5d866757de23e06d0662aae25) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date & time inputs: the picker trigger buttons now have a 44px tap target (invisible hit-area extension, no visual change). Time picker: options gain visual hierarchy (muted until interacted, tinted roving anchor, column separators) and the columns keep a half-faded number at each edge as a scroll cue.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1d8b757`](https://github.com/ethlete-io/ethdk/commit/1d8b7570f7d65a59616b99a93243b4ba7a9c9d53) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icons: the `@ethlete/components:icons` generator no longer emits a `GENERATED_ICONS` aggregate array — spreading it into `provideIcons()` registered every icon and defeated tree shaking. Import the individual `IconDefinition` constants instead; re-running the generator removes the array from the generated file.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: anchored arrows (menu, tooltip, toggletip) now match the pane's actual background and border, so an arrow no longer stays a surface elevation too low when its pane sits on a raised surface (e.g. a menu opened from a filled form-field).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlays and menus now open on insecure origins (plain-HTTP pages on a LAN IP, not just `localhost`/HTTPS). Id generation used `crypto.randomUUID()`, which is `undefined` outside a secure context, so opening any dialog, sheet, anchored overlay or menu threw and only the backdrop appeared. A new `randomId()` helper in `@ethlete/core` uses `crypto.randomUUID()` when available and falls back to `getRandomValues` otherwise.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`00b7c33`](https://github.com/ethlete-io/ethdk/commit/00b7c337e5ae0ac1bfc7186237b1ac2879eb018d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Theming: overlay panes (menu, select) now resolve their color context through passive providers and apply it before the first painted frame.
  - `ProvideColorDirective` gains `resolvedColor` — the color that actually applies at the provider's location, falling through passive providers like the CSS cascade does. `syncWithProvider` uses it, so a passive in-between provider (e.g. a form field's) no longer erases the theme inside a detached overlay pane.
  - The menu and select panels install the context sync during construction instead of in an effect, eliminating a wrong-theme flash during the enter animation.

- [#3025](https://github.com/ethlete-io/ethdk/pull/3025) [`416cfb8`](https://github.com/ethlete-io/ethdk/commit/416cfb8c3f370783a96b2fe59b827e981cac7b17) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay sheets: fix the black gap that appeared at the docked edge while a sheet sprang into view. The enter spring overshoots slightly past the docked edge, and the filler meant to cover that gap was an `::after` strip positioned just outside the host — which sheets clip away with their `overflow: hidden` (kept for the rounded corners), so nothing painted and the page background showed through (most visible with sheets whose surface is painted on nested content, e.g. the date picker). The filler is now a solid offset `box-shadow`, which is not clipped by the host's own overflow and needs no change to the corner clipping. Its color is measured from the sheet's actually-painted surface at open time, so it matches even when that surface sits on nested content one elevation above the container host (where the host's own surface token would be a shade off).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1fa8e45`](https://github.com/ethlete-io/ethdk/commit/1fa8e4543c976658d0fbee5902ce43b9418932c3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the sidebar page component no longer triggers an `NG0912` component ID collision when `@ethlete/cdk` is loaded in the same app.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the selection (floating) toolbar is now a pointer-device-only enhancement. On touch it fought the platform's native selection menu (Copy/Paste/…) and appeared unreliably, so it is suppressed there — the always-visible static toolbar covers formatting on touch. Mouse/trackpad behavior is unchanged.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`428f971`](https://github.com/ethlete-io/ethdk/commit/428f9718c96038a4aa9fee603b11ea341c7fe99b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor fixes:
  - The table size picker now supports arrow-key navigation (Enter/Space inserts the selected size, Escape/Tab close the menu from a focused cell).
  - Toolbar buttons draw their focus ring on the button edge instead of 3px outside it, where it stacked on the field border and neighboring buttons.
  - Applying a link with Enter no longer leaks a line break into the editor.
  - Whitespace at the edges of the linked selection now stays outside the created anchor instead of being swallowed (e.g. the trailing space of a word selection).

## 1.0.0-next.21

### Minor Changes

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Menu: `et-menu-radio-item` and `et-menu-checkbox-item` take an optional `icon` input that renders a registered icon in place of the radio dot / checkmark (the checked state shows through the icon's accent color). The rich text editor's alignment and text-style menus now use icons this way.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`1d7aaca`](https://github.com/ethlete-io/ethdk/commit/1d7aacaec10f3d3d7278733ebf5d834e8a89b1f7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: add opt-in, tree-shakeable building-block autocomplete. Add the
  `etRichTextEditorTriggers` directive (with `RICH_TEXT_EDITOR_TRIGGERS_IMPORTS`) and pass triggers
  built with `createRichTextEditorTrigger` — typing a trigger char (e.g. `#`, `@`) opens a
  caret-anchored, menu-styled popup, and picking an item inserts an atomic `{{type:id}}` token chip.
  Item sources can be static, `Promise`, or `Observable`. Use `provideRichTextEditorTokenRendering(...)`
  to render stored token values as chips in read-only contexts, or `createRichTextEditorTriggerWithQuery(...)`
  to back a trigger with an `@ethlete/query` query (results, loading and error wired automatically).

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added an opt-in **alignment** tool. Provide `provideRichTextEditorAlignmentTool()` and include `'align'` in the editor's `tools` to get a block-alignment menu (left / center / right / justify) that also works inside table cells. The button reflects the caret's current alignment live. Alignment has no Markdown form, so it persists as a native `text-align` style and round-trips as raw HTML.

  `@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip block elements carrying a `text-align` style (preserved verbatim as native HTML).

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`af660e3`](https://github.com/ethlete-io/ethdk/commit/af660e346204d18ad39cc700c8698bb897fba339) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added **inline code** and **underline** formatting tools (in the static and selection toolbars, and the default toolbar). Inline code round-trips as `` `code` ``; underline is preserved as native `<u>` since Markdown has no underline form.

  `@ethlete/core`: `htmlToMarkdown`/`markdownToHtml` now round-trip `<u>` (underline) instead of dropping it.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: list items can now be nested. **Tab** nests the current item under the previous one, **Shift+Tab** lifts it out one level, and **Enter**/**Backspace** on an empty item step out one level at a time (leaving the list entirely only at the top level). Marker styles cycle by depth (disc → circle → square, and decimal → lower-alpha → lower-roman).

  `@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip **nested** lists (two-space indentation per level), instead of flattening them.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: Markdown autoformat while typing (opt out with `autoformat=false`). Line-start prefixes convert on space — `-`/`*`/`+` into a bulleted list, `1.` into a numbered list, `#`–`###` into a heading — and closing an inline run (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `__`/`_`) converts it into its mark with the caret placed after it. Autoformat is token-aware: registered trigger characters are reserved (a `#` trigger keeps opening its autocomplete instead of becoming a heading) and conversion is suspended while a trigger popup is open.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: pasted HTML is now normalized into the editor's own schema (foreign tags, inline styles, classes and scripts never enter the editable DOM; token chips keep their identity), and pressing Enter at the edge of a heading starts a plain paragraph instead of continuing the heading. Shift+Enter always stays a soft line break.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: the heading menu and list buttons now disable themselves while the caret is inside a table cell (a GFM table cell can only hold inline content, so block markup there would not survive serialization), instead of silently doing nothing. Custom tools can opt into the same behavior via the new `isDisabled` callback on `RichTextEditorToolDefinition`. The Cmd/Ctrl+U shortcut now runs through the editor's own underline command like the other formatting shortcuts.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added an opt-in **table** tool. Provide `provideRichTextEditorTableTool()` and include `'table'` in the editor's `tools` to get a toolbar control that inserts a table via a grid-size picker and edits it (insert/delete rows and columns, delete table) when the caret is inside one. Tables round-trip as GFM pipe tables. The tool and its DOM operations are only referenced from the provider, so they tree-shake away when not used.

  Toolbar tools are now extensible: register a `RichTextEditorToolDefinition` (a toggle button or a custom control component) via the `RICH_TEXT_EDITOR_TOOL` multi-provider token.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`af660e3`](https://github.com/ethlete-io/ethdk/commit/af660e346204d18ad39cc700c8698bb897fba339) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the toolbar is now configurable. A new `tools` input takes an ordered list of tool tokens (`'bold' | 'italic' | 'strike' | 'heading' | 'bulletedList' | 'numberedList' | 'link' | 'divider'`), and `provideRichTextEditorTools(...)` sets the default for a scope. The block style is now picked from a `heading` menu (Normal / Heading 1–3) shown first in the toolbar, and toolbar buttons are larger and squarer.

  Form field: read-only text controls (`et-input`, `et-rich-text-editor`) now keep their normal box but drop all interactive affordances — no hover/focus border change, default cursor — so read-only reads as view-only content, distinct from disabled.

  Icon button: added an `--et-icon-button-border-radius` custom property so an ancestor context (e.g. a toolbar) can square off the otherwise fully-round button.

  Overlay (`@ethlete/core`): anchored overlay positions accept an optional `boundary`, so an anchored pane (e.g. the editor's selection toolbar) can be kept inside a region and flip instead of overflowing it.

### Patch Changes

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`1d7aaca`](https://github.com/ethlete-io/ethdk/commit/1d7aacaec10f3d3d7278733ebf5d834e8a89b1f7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `injectAnimatedBlockSize` — a core util that smoothly animates an element's `block-size` as its
  content resizes (baseline captured on first render so the initial layout never plays as a
  grow-from-0, interruption-safe, respects `prefers-reduced-motion`). `et-menu` and the rich text
  editor's trigger popup now share it, giving a more consistent, smoother resize.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: the disabled treatment (dimmed frame, blocked pointer events, hint color) is now driven by the registered control's disabled state via a `data-disabled` host attribute instead of `:has(:disabled)` — a composite control like the rich text editor can disable individual toolbar buttons without the whole field being dimmed and made unclickable.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`7e4c883`](https://github.com/ethlete-io/ethdk/commit/7e4c8832493b8c8b505efd80acfa147d90bc9523) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field: only a `filled` field raises the surface elevation for its contents — a `transparent` field now stays flush with its parent surface instead of bumping elevation without a painted background.

  Rich text editor: the autocomplete popup no longer renders one elevation too high (it now matches menus), and its "source failed" error state is a centered icon-and-message panel instead of a stray line in an empty box.

  Rich text editor: token chips (merge fields, mentions) now render as a tonal accent pill with a hairline ring — and keep their trigger char (`@`, `#`, …) visible as a de-emphasized prefix — so they read clearly as distinct entities in the prose, instead of a faint neutral highlight.

  Rich text editor: the selection formatting toolbar now mounts through the overlay system (like the autocomplete popup) instead of a manually-positioned fixed element — so it shares the same anchoring, stacking, theming, and enter/leave animation.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`d362747`](https://github.com/ethlete-io/ethdk/commit/d3627470bddd16a6b76577ac8d3dc43d9d7fdd2e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored arrow now matches the pane it points at — it paints the
  pane's actual background and mirrors its border (including no border when the
  pane has none), instead of re-deriving a color from surface tokens that could
  diverge from a custom `panelClass` or themed pane.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: apps using both `@ethlete/components` and `@ethlete/cdk` no longer log `NG0912` component ID collision warnings on bootstrap.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: the alignment tool now applies to the whole table column (GFM alignment is per column, so a single aligned cell would not survive serialization) and disables itself inside lists, where alignment has no serialized form. Lists swept up by a cross-block selection are skipped instead of receiving a lost `text-align`.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`bf72655`](https://github.com/ethlete-io/ethdk/commit/bf7265505ecaf77f2bc239fd945f763655af5b82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: toggling an inline format (bold, italic, underline, strike, code) with **no selection** now works as expected — it sets a pending "stored mark" so the next typed text picks up (or drops) that formatting, instead of doing nothing. The pending state shows in the toolbar and is cleared when you move the caret.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: block alignment is no longer lost when re-tagging between paragraph and heading, and the heading menu now disables itself inside list items (where a heading has no serialized form), matching the table-cell behavior.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`e06f250`](https://github.com/ethlete-io/ethdk/commit/e06f250aec6997bf34dacef00e8cdcb9ce1d8819) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: fixed formatting a selection then applying a heading dropping the inline mark (e.g. bold text turned into a heading lost its `<strong>`), and a follow-up fix so the first toggle-off click after a block-level command actually removes the mark instead of no-op-ing.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: pressing ArrowRight at the end of an inline code span (or ArrowLeft at its start) now steps the caret outside the code, so continuing to type isn't code.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: table editing polish — arrow keys now step the caret cleanly across table edges (into the nearest cell when entering, onto a real line when exiting, adding one only when the table is flush against the editor's top/bottom) instead of stranding it at the table border; an empty line directly above a table can be removed with Backspace; and applying an inline format across multiple selected cells now wraps each cell's content within its own cell instead of tearing the table apart.

## 1.0.0-next.20

### Major Changes

- [`44adcac`](https://github.com/ethlete-io/ethdk/commit/44adcac94d7e0f56742e02901221c6e04da7df47) Thanks [@TomTomB](https://github.com/TomTomB)! - Rename past-tense outputs to the present tense, matching native DOM event naming (enforced by the new `ethlete/prefer-present-tense-output` lint rule):
  - `etMenuItem` (and `et-menu-item` / `et-menu-checkbox-item` / `et-menu-radio-item`): `activated` → `activate`
  - `etDropzone` / `et-dropzone`: `filesRejected` → `filesReject`, `uploadSucceeded` → `uploadSucceed`, `uploadFailed` → `uploadFail`
  - `et-grid-item`: `removed` → `remove`

  Update the corresponding template bindings, e.g. `(activated)` → `(activate)`, `(uploadSucceeded)` → `(uploadSucceed)`, `(removed)` → `(remove)`.

### Minor Changes

- [#3018](https://github.com/ethlete-io/ethdk/pull/3018) [`e8f9bcd`](https://github.com/ethlete-io/ethdk/commit/e8f9bcd65b40724b266aff8949951649afafea36) Thanks [@github-actions](https://github.com/apps/github-actions)! - Move all component styles into the `components` CSS cascade layer (`@layer components`).

  Component CSS was previously injected unlayered, which meant it beat Tailwind
  utility classes (in `@layer utilities`) regardless of specificity — forcing
  consumers to reach for `!important` (e.g. `flex!`) to override layout, spacing or
  sizing on components. Because layer precedence is resolved before specificity,
  `:where()` could not fix this.

  Now that component rules live in `@layer components` (which Tailwind v4 orders
  before `utilities`), a plain utility class overrides component styles without
  `!important`. This is a behavior change: any consumer rule that is unlayered or
  in a later layer now wins over component styles by default. Apps using the
  default Tailwind v4 layer order (`theme, base, components, utilities`) get the
  fix automatically; apps that customize layer order should ensure `components`
  sorts before their utilities.

## 1.0.0-next.19

### Patch Changes

- [`09ed801`](https://github.com/ethlete-io/ethdk/commit/09ed8010644643a7f019652f986d8454a4cdbdb3) Thanks [@TomTomB](https://github.com/TomTomB)! - Icon button & FAB: sizes now match the surface button's height at every size (`xs`–`xl`), so they line up in a row.

- [#3017](https://github.com/ethlete-io/ethdk/pull/3017) [`4913e22`](https://github.com/ethlete-io/ethdk/commit/4913e226918ab5200b500620bae37c063af0e7ca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay arrows: anchored-overlay arrows (menu, tooltip, toggletip) now take their background and border from the surface theme by default, so the arrow border stays visible and matches the panel under any theme. Override via `--et-overlay-arrow-background` / `--et-overlay-arrow-border`.

## 1.0.0-next.18

### Major Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`bd4a07f`](https://github.com/ethlete-io/ethdk/commit/bd4a07f6e718ed637a6e9f0d54b0c2dbfae37236) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: replace the curried overlay handler API with an explicit define/create pair, and merge overlay configs additively instead of replacing them.
  - `createOverlayHandler` and `createOverlayHandlerWithQueryParamLifecycle` are removed. Define an overlay once at module scope with `defineOverlay({ component, ...config })` (or `defineQueryParamOverlay({ component, queryParamKey, ...config })` for URL-driven overlays), then create an opener in an injection context with `createOverlayOpener(definition, { afterClosed, ...config })`.
  - Overlay configs now merge additively across definition → opener → per-open layers: `bindings`, `providers`, `hostClass`, `backdropClass` and `panelClass` are concatenated instead of the most specific layer silently replacing the rest; scalar options still follow most-specific-wins. The merge is exposed as `mergeOverlayConfigs(...configs)`.
  - Inside the overlay component, access the typed ref via `definition.injectRef()` (replaces the handler's `injectOverlayRef`). It throws an actionable `RuntimeError` when called outside an open overlay.
  - `defineQueryParamOverlay` requires the component to expose an `overlayQueryParam` model at compile time (previously a silent runtime requirement), and the opener's `open(value)` is typed from that model's value type. Definition- and opener-level `bindings`/`providers` are now applied on every URL-driven open, so components with additional inputs work with query-param overlays.
  - `OverlayHandlerLinkDirective` (`etOverlayHandlerLink` + `etOverlayHandlerQueryParamName`) is replaced by `QueryParamOverlayLinkDirective`: `<a [etQueryParamOverlayLink]="definition" etQueryParamOverlayLinkValue="42">` — the link takes the definition object, so the query param key is no longer duplicated as a string.

  Migration:

  ```ts
  // before
  const openProductOverlay = createOverlayHandlerWithQueryParamLifecycle<ProductOverlayComponent>({
    component: ProductOverlayComponent,
    strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
    queryParamKey: 'product',
  });
  // in a component
  handler = openProductOverlay();

  // after
  export const productOverlay = defineQueryParamOverlay({
    component: ProductOverlayComponent,
    strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
    queryParamKey: 'product',
  });
  // in a component
  opener = createOverlayOpener(productOverlay);
  ```

### Minor Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`2f18e43`](https://github.com/ethlete-io/ethdk/commit/2f18e4344759dbbcd17ba0dbeca138f1f7043cdf) Thanks [@github-actions](https://github.com/apps/github-actions)! - Anchored overlays: the `shift` option now also accepts `{ crossAxis?: boolean }` in addition to a boolean. With `crossAxis: true`, an overlay that fits on neither side of its reference is shifted along the placement's cross axis to stay inside the viewport (it may then overlap the reference) instead of overflowing off-screen.

  Menus enable this by default: a nested submenu near the viewport edge first flips to the other side and, when neither side fits, slides over its parent menu — matching native OS menu behavior — instead of being cut off by the viewport.

  The `size` middleware (`autoResize`) now runs after `shift` instead of before it, so `--et-overlay-max-width` / `--et-overlay-max-height` are measured from the pane's shifted position. Previously a cross-axis-shifted pane had its max size capped to the unshifted leftover space, squeezing e.g. a submenu to a sliver instead of letting it keep its width while overlapping its parent.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`789d765`](https://github.com/ethlete-io/ethdk/commit/789d765e1342f92d1269f1d8a1dbb64e28415708) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-dropzone` file-upload control with a built-in `@ethlete/query` upload workflow. Import `DROPZONE_IMPORTS`.
  - Files are picked via click or drag & drop and uploaded through a consumer-provided query, one query per file. Configure with `createDropzoneUpload({ queryCreator, selectValue, createArgs?, resolveExisting? })` — `selectValue` maps the upload response to the form control value (e.g. `(media) => media.uuid`).
  - Signal-forms native (`[formField]`): the control value holds the values of successful uploads (and existing entries) in entry order — `TValue | null` in single mode, `TValue[]` with `multiple`. In-flight and failed uploads never enter the value; block submits via the headless `anyUploading` signal.
  - Built-in UI: per-file progress bars (requires `reportProgress: true` on the query creator and the XHR `HttpClient` backend; degrades to indeterminate otherwise), image previews via object URLs, remove/replace/retry via regular icon buttons, and enter/leave animations (FLIP shift plus scale-out on delete, disabled under `prefers-reduced-motion`). In single mode a successful upload replaces the drop area with a same-size preview (no layout shift).
  - Validation lives in the form schema: `required()`/`minLength()`/`maxLength()` cover emptiness and file count, and the new `dropzoneFiles()` schema rule declares file constraints (`accept`, `maxFileSize`, `minFileSize`). Violating files never upload — each violation becomes a regular validation error on the field (customizable via the rule's `message` function) and is emitted via `filesRejected`. Upload failures render as validation-style messages below the field (`uploadErrorMessage` input).
  - Edit forms: values already present in the control render as entries via the `resolveExisting` display resolver.
  - Full behavior is available headlessly via the `etDropzone` directive (`entries()`, `lastRejections()`, `selectFiles()`, `removeEntry()`, `retryEntry()`, `clear()`, `isDragOver`, …). Error codes `ET2400`–`ET2499`.

  Icons: new built-in `UPLOAD_ICON` (`et-upload`), `FILE_ICON` (`et-file`) and `ROTATE_RIGHT_ICON` (`et-rotate-right`) definitions. The dev-mode icon color validation now allows `fill="none"` / `stroke="none"` (only actual hardcoded colors are rejected).

  **`@ethlete/components` now has a peer dependency on `@ethlete/query`** (`^6.0.0-beta.8`).

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid & Tabs: the previously allocated error codes are now actually enforced, and a nav-tabs composition bug is fixed.
  - Tabs (dev mode): `ET2000` when a tab trigger has no enclosing tab bar, `ET2001` when `<et-tab>` / `etTabPanel` sit outside a tab group (an orphan `<et-tab>` used to disappear silently), `ET2002` when a headless tab group has triggers but no panels, `ET2003` when nav-tab pieces are used without `et-nav-tabs`.
  - Grid (dev mode): `ET1900` for items outside a grid, `ET1901` for drag/resize handles outside a grid item, `ET1902` for duplicate item ids, `ET1903` when `restoreState()` receives unknown breakpoint names, and the new `GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE` (`ET1904`) when an item's `type` has no registration — previously such items were silently dropped.
  - Fixed: `<et-nav-tabs-outlet>` placed as a sibling of `<et-nav-tabs>` (the documented composition) crashed with a DI error. It now resolves the tab bar that labels it automatically when exactly one `et-nav-tabs` exists on the page, and still prefers an ancestor tab bar when nested.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: trigger-anchored root menus now render a floating arrow pointing at their trigger, matching the tooltip and toggletip look. The new `arrow` input on `[etMenu]` (default `true`) controls it — set `[arrow]="false"` to opt out — and `arrowPadding` (default `8`) tunes how close the arrow may get to the panel corners. Submenus and context menus (point-anchored) never render an arrow.
  - With the arrow enabled, the `'auto'` offset resolves to `10` so the arrow has room between the panel and its trigger; disabling the arrow restores the previous tight spacing. Submenu and context menu spacing is unchanged.
  - The arrow picks up the menu surface theme (`--et-surface-background-solid` / `--et-surface-border-solid`) and can be overridden via `--et-overlay-arrow-background` and `--et-overlay-arrow-border`.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`2f18e43`](https://github.com/ethlete-io/ethdk/commit/2f18e4344759dbbcd17ba0dbeca138f1f7043cdf) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the menu now fully respects the surface and color theming systems instead of shipping a hardcoded dark palette.
  - Borders, separators, muted text (group labels, shortcuts, the search placeholder/spinner) and the search input fill now derive from the surface tokens (`--et-surface-border-solid`, `--et-surface-color-muted-solid`, `--et-surface-interaction-solid`).
  - The active menu item highlight is now a `color-mix` tint of `--et-surface-interaction-solid` instead of a fixed white overlay.
  - The menu panel resolves its surface via `AutoSurfaceDirective`, automatically picking the next elevation relative to the trigger's surface context.
  - Destructive menu items and the search error message now use the app's registered `error` color theme (via `injectErrorTheme()`), so `--et-theme-color-primary-*` resolves to the error palette inside them. The `--et-menu-item-destructive-color` token has been removed — theme the error color theme instead. Like `et-form-field`, `et-menu` now requires color themes (including one with `type: 'error'`) to be registered.
  - Selection item check/radio marks and the search input focus border now use `--et-theme-color-primary-solid` from the surrounding color theme context.
  - The active-item highlight now only shows for an actual hover or `:focus-visible` (keyboard) interaction — opening a menu with the mouse no longer highlights the first item, while keyboard-opened menus still do. A trigger item whose submenu is open stays highlighted via `[data-menu-open]`.
  - The menu animates its block size (160ms) when its content changes while open — e.g. search filtering items away or the search error line appearing — instead of snapping to the new size. Respects `prefers-reduced-motion`.
  - Menu items now have a pressed (`:active`) state — a stronger tint of the surface interaction color (20% vs the 12% highlight) — and transition `background`, `color` and `opacity` (120ms) between their rest, highlighted, pressed and disabled states. The search input transitions its `border-color` and `background`, matching the button's interaction feel.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`8d5c7dc`](https://github.com/ethlete-io/ethdk/commit/8d5c7dce47c0b04592ebe366354871f177d55f0a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: visual refresh and new options for the selection controls (checkbox group, radio group, segmented button group, switch, choice field).
  - Checkbox options and radios: option labels now render in the regular text color at a fixed size, boxes/circles gained hover tint fills, press feedback and a draw-in checkmark animation; the group label is styled like a form-field label (new `--et-<group>-group-label-font-size` tokens).
  - Selection-list groups (`et-checkbox-group`, `et-radio-group`, `et-segmented-button-group`) now support a projected `<et-label>` as group label — it shows the required marker (`*`) and wires `aria-labelledby` automatically. The plain `.et-<group>-label` span still works for label text without the marker.
  - Segmented button group: redesigned as a tonal track with a filled active pill that animates between options (flip animation). `--et-segmented-button-border-width` was removed; new tokens `--et-segmented-button-border-radius`, `--et-segmented-button-group-track-padding`, `--et-segmented-button-group-track-radius` and `--et-segmented-button-group-label-font-size`.
  - Switch: reworked visuals — the off state uses a neutral tinted track with a smaller muted thumb that grows and slides on toggle, plus a press-stretch effect. Default dimensions changed to a 40×22px track with a 16px thumb.
  - New `size` input (`'sm' | 'md' | 'lg'`, default `'md'`) on `et-checkbox-group`, `et-radio-group`, `et-segmented-button-group` and `et-choice-field`, scaling controls, labels and gaps in line with `et-form-field` sizes.
  - Group error states now tint the unchecked control borders with the error color (previously only the error message was colored).
  - The control CSS tokens (`--et-checkbox-*`, `--et-checkbox-option-*`, `--et-radio-*`, `--et-segmented-button-*`, `--et-switch-*`) are now registered as inheriting custom properties, so overriding them on the component or a wrapper actually reaches the inner elements that consume them.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`6e9693a`](https://github.com/ethlete-io/ethdk/commit/6e9693a9352d19775f46ab5424cbdea455a14ee5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Button: new split button. `<et-split-button>` groups an action segment (`etSplitButtonAction`) and a trigger segment (`etSplitButtonTrigger`) — both regular surface/icon buttons — into one `role="group"` control with joined corners and a divider between the segments.
  - The segments keep the full button API (variant, size, color, disabled, loading); the trigger typically also carries `etMenuTrigger` to open a menu with related actions.
  - The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%).
  - The headless `SplitButtonDirective` (`[etSplitButton]`) plus the segment directives are exported for custom-styled split buttons.
  - Missing or misplaced segments throw dev-mode errors in the new `ET23xx` range.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: theming overhaul and cleanups.
  - The PiP chrome now provides a surface theme scope (`type: 'dark'`, elevation 1) — it is mounted into `document.body` and previously had no theme context at all.
  - The PiP window glass background derives from the surface theme (`60%` of `--et-surface-background-solid`) instead of hardcoded `rgba(0, 0, 0, 0.6)`; `--et-pip-bg` remains as an override hook but is no longer a registered `@property`.
  - The featured-cell ring in PiP grid mode uses `--et-theme-color-primary-solid` instead of hardcoded `#3b82f6`; `--et-stream-pip-chrome-featured-ring-color` remains as an override hook (no longer a registered `@property`). The hover ring and resize handles now derive from surface tokens too.
  - Scrollable: `ScrollableErrorCode` is removed in favor of `SCROLLABLE_ERROR_CODES`, matching every other domain's naming.
  - Internal: platform iframes set the legacy `scrolling` attribute via the renderer instead of the deprecated DOM property.

### Patch Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`eabe123`](https://github.com/ethlete-io/ethdk/commit/eabe123414ec3cb39ed8bc1acdb3446599eeb0d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Error codes: resolve a range collision where tabs, scrollable, and form field reused the icon domain's `ET18xx` codes. Each domain now owns a unique 100-code block:
  - Tabs: `TAB_ERROR_CODES` moved from `1800–1803` to `2000–2003`.
  - Scrollable: `ScrollableErrorCode.MISSING_SCROLL_CONTAINER` moved from `1800` to `2100`.
  - Form field: `FORM_FIELD_ERROR_CODES.MISSING_CONTROL` moved from `1800` to `2200`.

  Icon keeps `1800–1899`. If you match on these numeric values (or on `ET1800`-style codes in error messages), update to the new numbers.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`57f0e15`](https://github.com/ethlete-io/ethdk/commit/57f0e1542871ec39efd928e5f575ef5bad103269) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icon button: fix the icon size not scaling with the button `size`. The icon was
  stuck at 20px for every size because the `--_et-icon-button-icon-size` custom
  property was registered as non-inheriting while being set on the button host and
  read on the nested icon element. Icons now scale correctly across `xs`–`xl`. The
  same fix is applied to the window control button icon.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`7110a06`](https://github.com/ethlete-io/ethdk/commit/7110a068208586f5906da1fc387c5181b2d1ec1a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the floating arrow no longer affects or overlaps the panel content.
  - The overlay arrow is now clipped at the panel edge (it only keeps the outer tip plus the border seam), so the menu no longer adds extra clearance padding on the arrow side — padding is identical regardless of placement.
  - `arrowPadding` on `[etMenu]` now defaults to `14` (was `8`) so the arrow can no longer slide into the panel's rounded corners.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`90eeba1`](https://github.com/ethlete-io/ethdk/commit/90eeba1e6dbac11cfaef7cd4c2f0a5fa6234d642) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the anchor arrow no longer overlaps the panel's edge content. The rotated
  arrow dips into the panel edge nearest the trigger, which previously cut into the
  search field (panel below the trigger) or the first/last menu items (panel above
  the trigger). The adjacent content now keeps clear of the arrow.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored overlay arrow (tooltip, toggletip, anchored dialog) no longer flashes for a frame before the enter animation starts. The arrow now stays hidden while the overlay is still waiting to animate in, instead of briefly appearing, disappearing, and fading in again.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: accessibility fixes for the built-in overlays and self-created player iframes.
  - The iframes created by the Kick, SOOP, Dailymotion and TikTok players now carry a descriptive `title` (`"<Platform> player"`). YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and cannot be titled from the library.
  - The loading overlay is now a `role="status"` region labelled "Loading", the error overlay announces itself via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Text button: the underline is no longer shown in the resting state — it now animates in on hover, focus and press, and sits tight under the label (link-style) instead of hanging below the button's line box. Resting text buttons now align optically with neighboring buttons of the same size.

## 1.0.0-next.17

### Major Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: replace the `inputBindings` / `outputBindings` config objects with a
  single `bindings` array using Angular's native binding API. Bind overlay
  component inputs, outputs, and two-way models with `inputBinding`,
  `outputBinding`, and `twoWayBinding` from `@angular/core`.

### Patch Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix icon directive typing and improve the icon generator config.
  - `IconDirective` now explicitly annotates its inputs as `InputSignal<RegisteredIconName>` and `InputSignal<RegisteredIconVariant | undefined>`. Without the annotation the d.ts bundler inlined the registry aliases to `string`, so consumer-side `declare module` augmentation of `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` had no effect. `etIcon`/`variant` are now actually narrowed to the registered names.
  - The `@ethlete/components:icons` generator config takes a top-level `variants` list (replacing the singular `defaultVariant`). Bare string entries — and object entries without their own `variant`/`variants` — inherit it, so a set of icons that all share a style no longer needs the variant repeated on every entry.
  - The generator's `source: "auto"` sentinel is now honored when set in the config file (previously only the CLI default auto-detected; a config `"auto"` was treated as a package literally named "auto").

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay routing: a shell that wraps only the router outlet (each route carries its own `et-overlay-main` with header/body/footer) now reliably bounds the outlet to the pane. The shell content grid pins both axes (`grid-template-columns`/`grid-template-rows: minmax(0, 1fr)`), so the outlet fills a fixed-height dialog and the routed page's body scrolls with its header and footer pinned — instead of the whole overlay scrolling. The `minmax(0, ...)` column also stops a wide child (e.g. a rich-text editor) from blowing the grid past the pane width.

## 0.1.0-next.16

### Minor Changes

- [`89a1d38`](https://github.com/ethlete-io/ethdk/commit/89a1d383cea36583c9459bd13e6c41ec25e0ecb7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add icon variants and an icon generator.
  - `IconDefinition` gains an optional `variant`, and `provideIcons` now keys the registry by name + variant, so the same icon name can exist in multiple styles.
  - `IconDirective` gains a `variant` input: `<i etIcon="shield" variant="light">`. When omitted it matches a variant-less icon first, then falls back to the `solid` variant.
  - `etIcon` and `variant` are now typed against the augmentable `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` interfaces (they stay `string` until augmented).
  - New `@ethlete/components:icons` generator reads a small config, auto-detects an installed SVG source (Font Awesome pro then free), and generates `IconDefinition` constants plus a `.d.ts` that augments the registries. Run with `nx g @ethlete/components:icons`.

### Patch Changes

- [`ea1eb65`](https://github.com/ethlete-io/ethdk/commit/ea1eb656b4f1144602830a3cd27a521ca50a9d06) Thanks [@TomTomB](https://github.com/TomTomB)! - Theming: add `AutoSurfaceDirective` (`etAutoSurface`), which resolves the surface
  theme one elevation above its parent (or an explicitly provided) surface context
  and applies it through a host `ProvideSurfaceDirective`. Meant to be used as a
  host directive on components that render inside a detached overlay pane, where
  surface context can't cascade through the DOM.

  Tooltip and toggletip now use `AutoSurfaceDirective` as a host directive instead
  of duplicating the auto-surface resolution logic. No change to their rendered
  surface.

- [`efe9cc3`](https://github.com/ethlete-io/ethdk/commit/efe9cc30b61245fd3c7fd1eaeedc3be7b85ed275) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: prevent text selection inside a grid item when dragging it in
  non-readonly mode. `user-select` is now disabled on the item content whenever the
  grid is editable, instead of only after a drag has committed — so the initial
  pointer movement before the drag threshold no longer selects the item's text.

- [`70308a7`](https://github.com/ethlete-io/ethdk/commit/70308a7e0ce81d97c91d55fb7f619f1384a0e3bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay routing: support routes that nest their own `et-overlay-header`/`et-overlay-body`/`et-overlay-footer` (a full `et-overlay-main`) directly inside the router outlet, without a shared shell or sidebar. Previously the active route grew past the overlay, pushing the footer off-screen and preventing the body from scrolling.
  - The router-outlet content wrapper now propagates a bounded height, so each route's body scrolls with its header and footer pinned. Combine with a fixed dialog height to keep a stable size across navigation.
  - On navigation, focus now moves to the first sensible element of the new page (first-tabbable, so buttons/inputs win over headings), mirroring the overlay's open-time `autoFocus` behaviour and respecting the configured `autoFocus` (including `false`). It falls back to the page container when the page has nothing tabbable.
  - Removed the stray focus outline that appeared around the whole modal on window blur/refocus, caused by the programmatically focused page container.

## 0.1.0-next.15

### Minor Changes

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: layout changes are now animated. The container height transitions smoothly as items are added, removed, or reflowed, and items animate on enter and leave instead of snapping. Animations are automatically disabled during the initial render and while the container width is settling (e.g. on resize) so placement never animates unexpectedly, and are fully suppressed for users who prefer reduced motion. Animation duration is tunable via the `--et-grid-anim-duration` custom property.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: dragging an item near the edge of a scrollable ancestor now auto-scrolls the container, so items can be moved to positions that are off-screen without letting go. The scroll speed ramps up with edge proximity and stops as soon as the drag ends.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a new `Menu` component and headless menu primitives. It provides a fully accessible, overlay-anchored menu system built on the styled components `MenuComponent` (`et-menu`), `MenuItemComponent` (`et-menu-item`), `MenuItemShortcutComponent` (`et-menu-item-shortcut`), `MenuSeparatorComponent` (`et-menu-separator`), `MenuGroupLabelComponent` (`et-menu-group-label`), and the selection components `MenuRadioGroupComponent` / `MenuRadioItemComponent` and `MenuCheckboxGroupComponent` / `MenuCheckboxItemComponent`. All are bundled in `MenuImports`.

  Highlights:
  - Open a menu from any element with `etMenuTrigger`, nest submenus, and open at the pointer as a right-click context menu with `etMenuContextTrigger`.
  - Full keyboard support with roving focus, typeahead, and configurable hover intent so submenus don't flicker on diagonal pointer movement.
  - Single- and multi-select groups (`radio` / `checkbox` semantics) via `etMenuSelectionGroup` / `etMenuSelectionItem`.
  - Built-in filtering with `input[etMenuSearch]`, including async search sources.
  - Headless directives (`etMenu`, `etMenuPanel`, `etMenuItem`, `etMenuTrigger`, `etMenuContextTrigger`, `etMenuSelectionGroup`, `etMenuSelectionItem`, `etMenuSurface`, `input[etMenuSearch]`) are exported for building custom menu UIs.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: add `overlayRef.updatePositionStrategy(strategy)` to re-apply positioning with a new strategy without remounting the overlay. Useful for repositioning an open overlay (e.g. moving an anchored menu to a new reference or point). Note that a strategy-controller breakpoint switch will override this with its own strategy again.

### Patch Changes

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: rework drag and resize on a unified pixel/span geometry model so the live preview, the clamped pixel rect, and the snapped grid position can no longer disagree. This fixes item drift and overlap during fast drags and resizes near the grid bounds, keeps items within their configured min/max span constraints, and makes a drag snap to the pointer on commit instead of trailing it by the drag threshold.

- [`4e9f2b4`](https://github.com/ethlete-io/ethdk/commit/4e9f2b4d12335fafef192350aef8ffc584996a91) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove the now-redundant `changeDetection: ChangeDetectionStrategy.OnPush` declaration (and its `ChangeDetectionStrategy` import) from all components. OnPush is the default change detection strategy since Angular 22, so this is a no-op cleanup with no behavioral change.

## 0.1.0-next.14

### Minor Changes

- [#3002](https://github.com/ethlete-io/ethdk/pull/3002) [`6bf6d5c`](https://github.com/ethlete-io/ethdk/commit/6bf6d5cd11ed546b412abb93f518a60b4e09f857) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add heading options to rich text editor toolbar

## 0.1.0-next.13

### Minor Changes

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: replace the built-in `✕` remove button and its `showDefaultRemoveAction` config option with `GridItemDefaultActionsComponent` (`et-grid-item-default-actions`) — a toolbar with an icon remove button that is now rendered by default. It is used automatically when the grid config leaves `actionsComponent` unset; set `actionsComponent` to your own component to replace it, or to `null` to render no actions. Its aria label is configurable via the new `removeActionAriaLabel` grid config option (defaults to `'Remove item'`, run through `transformer`).

  Also removes the now-redundant drag-handle slot: the `dragHandleComponent` config option, the `dragHandleAriaLabel` config option, and the `etGridItemDragHandle` projection slot are gone. With whole-item drag the item content is the drag surface, so a dedicated handle is no longer needed — project a decorative grip into the item content instead.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: add `GridItemToolbarComponent` (`et-grid-item-toolbar`), a themeable container for per-item controls (edit, remove, …). Drop it into an item's action slot and project action buttons (e.g. `IconButtonComponent`) into it. It stops pointerdown so the toolbar is never a drag surface even when the whole item is draggable, and is themeable via the `--et-grid-item-toolbar-background` / `-gap` / `-padding` / `-radius` custom properties. Exported from the grid entrypoint and included in `GridImports`.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: in edit mode the whole item is now a drag surface — a pointerdown anywhere on the item content starts a drag, instead of only the drag handle slot. Interactive overlays (the actions slot, resize handles, or anything that stops propagation such as `GridItemToolbarComponent`) still win, and read-only grids keep their content inert. Also fixes the `et-grid--readonly` class never being applied to the grid host, so the intended read-only styles (non-interactive drag handle, hidden resize handles) now take effect, and adds a grab/grabbing cursor on the content while editing.

## 0.1.0-next.12

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 0.1.0-next.11

### Minor Changes

- [#2999](https://github.com/ethlete-io/ethdk/pull/2999) [`4a711fb`](https://github.com/ethlete-io/ethdk/commit/4a711fb9ce0acf53cd8fa71ce883520a79469563) Thanks [@github-actions](https://github.com/apps/github-actions)! - Port over overlays to components lib

- [`2a37d6d`](https://github.com/ethlete-io/ethdk/commit/2a37d6dc75cafb8af06c0912dffcdc67eca63086) Thanks [@TomTomB](https://github.com/TomTomB)! - Add floating toolbar to rich text editor

## 0.1.0-next.10

### Patch Changes

- [`c52eb0b`](https://github.com/ethlete-io/ethdk/commit/c52eb0b80d79b30a8cd40584734c471c217565c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix muted until pressed style on buttons

- [`c52eb0b`](https://github.com/ethlete-io/ethdk/commit/c52eb0b80d79b30a8cd40584734c471c217565c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor formatting issues in rich text editor

## 0.1.0-next.9

### Minor Changes

- [#2995](https://github.com/ethlete-io/ethdk/pull/2995) [`5ca2461`](https://github.com/ethlete-io/ethdk/commit/5ca246117f43bac39ef73204c0e37871bad9781f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add basic rich text editor

## 0.1.0-next.8

### Minor Changes

- [`7dcbb8e`](https://github.com/ethlete-io/ethdk/commit/7dcbb8e3f3823728bc370fb89d1a89ee831e779b) Thanks [@TomTomB](https://github.com/TomTomB)! - Support surface theming in grid

## 0.1.0-next.7

### Patch Changes

- [`256b1b0`](https://github.com/ethlete-io/ethdk/commit/256b1b02d7598a0a6540af55447799a8ced469c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix grid overlapping items with invalid base config

## 0.1.0-next.6

### Patch Changes

- [`6ee86dc`](https://github.com/ethlete-io/ethdk/commit/6ee86dc6e2dde7ec6661d12e92fe1ceb87bc5800) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix grid edge cases

## 0.1.0-next.5

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 0.1.0-beta.4

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

- Updated dependencies [[`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766)]:
  - @ethlete/core@5.0.0-beta.11

## 0.1.0-next.3

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 0.1.0-next.2

### Minor Changes

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add tab and nav tab components

- [#2966](https://github.com/ethlete-io/ethdk/pull/2966) [`66d428d`](https://github.com/ethlete-io/ethdk/commit/66d428d14482e127972b0e0c6d6a5058800c7871) Thanks [@TomTomB](https://github.com/TomTomB)! - Add grid components

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add variants to icon and fab buttons

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add scrollable component

### Patch Changes

- [`8d31d0b`](https://github.com/ethlete-io/ethdk/commit/8d31d0b0ea523c6f79680e3a2cbf5ceba109f5d9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor style issues in pip components

## 0.1.0-next.1

### Minor Changes

- [#2958](https://github.com/ethlete-io/ethdk/pull/2958) [`8ecdfc0`](https://github.com/ethlete-io/ethdk/commit/8ecdfc00d785b0b535601b5d95ca7e2cd55455b6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Update default theming

## 0.1.0-next.0

### Minor Changes

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`bd86575`](https://github.com/ethlete-io/ethdk/commit/bd865753470ec770d5f182da33d6f8b27f18dceb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add button components, spinner component and new icons

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`3f22771`](https://github.com/ethlete-io/ethdk/commit/3f22771bb3a339461ce8c70a48e573897579f3c4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add notification components

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`3f22771`](https://github.com/ethlete-io/ethdk/commit/3f22771bb3a339461ce8c70a48e573897579f3c4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add stream components

All notable changes to this project will be documented in this file.
