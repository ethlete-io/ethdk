# Error codes

Every error the library throws is a [`RuntimeError` from `@ethlete/core`](/core/utilities#runtime-errors). Its message starts with a stable code - `ET1301: [MenuTriggerDirective] etMenuTrigger must be placed inside an [etMenu] element.` - so you can search this page for the code you see in the console.

```ts
import { RuntimeError } from '@ethlete/core';

try {
  // …
} catch (e) {
  if (e instanceof RuntimeError) {
    e.code; // 1301
  }
}
```

Some errors carry extra context (the offending config, element, …). That payload isn't serialized into the message - it's logged as a separate `console.error` right after the throw.

Two kinds of checks produce these errors:

- **Structural checks** (a directive placed outside its required parent, a missing required template) run **in dev mode only**, after the first render. Production builds skip them, so fix them during development - the broken structure will silently misbehave in production.
- **Runtime failures** (an icon name that isn't registered, a player SDK that fails to load) happen in production too.

A configuration error that is found while the app renders - an unknown icon name, invalid chart data, a duplicate grid item id - does not throw out of change detection. It goes to Angular's `ErrorHandler`, and the component renders nothing (or its empty state) until the input is fixed. Provide your own `ErrorHandler` to collect these. A setup mistake that makes the component unusable from the start, such as `ET1800` (no icons provided), still throws.

Each domain owns a 100-code block. The codes are exported per domain (e.g. `MENU_ERROR_CODES`, `OVERLAY_ERROR_CODES`) if you need to match on them programmatically.

| Range     | Domain                            | Guide                                              |
| --------- | --------------------------------- | -------------------------------------------------- |
| 1000–1099 | Select                            | [Select](/components/select)                       |
| 1100–1199 | Chip                              | [Chip](/components/chip)                           |
| 1200–1299 | Overlay                           | [Overlays](/components/overlays)                   |
| 1300–1399 | Menu                              | [Menu](/components/menu)                           |
| 1400–1499 | Tooltip                           | [Tooltip](/components/tooltip)                     |
| 1500–1599 | Toggletip                         | [Toggletip](/components/toggletip)                 |
| 1600–1699 | Stream                            | [Stream](/components/stream)                       |
| 1700–1799 | Notification                      | [Notification](/components/notification)           |
| 1800–1899 | Icon                              | [Icon](/components/icon)                           |
| 1900–1999 | Grid                              | [Grid](/components/grid)                           |
| 2000–2099 | Tabs                              | [Tabs](/components/tabs)                           |
| 2100–2199 | Scrollable                        | [Scrollable](/components/scrollable)               |
| 2200–2299 | Form field                        | [Forms](/components/forms)                         |
| 2300–2399 | Split button                      | [Button](/components/button)                       |
| 2400–2499 | Dropzone                          | [Dropzone](/components/dropzone)                   |
| 2500–2599 | Rich text editor                  | [Rich text editor](/components/rich-text-editor)   |
| 2600–2699 | Multi-language RTE                | [Rich text editor](/components/rich-text-editor)   |
| 2700–2799 | Tag input                         | [Text inputs](/components/text-inputs)             |
| 2800–2899 | Phone input                       | [Text inputs](/components/text-inputs)             |
| 2900–2999 | Calendar                          | [Calendar](/components/calendar)                   |
| 3000–3099 | Date & time inputs                | [Date & time inputs](/components/date-time-inputs) |
| 3100–3199 | Slider                            | [Slider](/components/slider)                       |
| 3200–3299 | Masked input                      | [Text inputs](/components/text-inputs)             |
| 3300–3399 | Cascader                          | [Cascader](/components/cascader)                   |
| 3400–3499 | Bracket                           | [Bracket](/components/bracket)                     |
| 3500–3599 | Table                             | [Table](/components/table)                         |
| 3600–3699 | Accordion                         | [Accordion](/components/accordion)                 |
| 3700–3799 | Breadcrumb                        | [Breadcrumb](/components/breadcrumb)               |
| 3800–3899 | Carousel                          | [Carousel](/components/carousel)                   |
| 3900–3999 | Masonry                           | [Masonry](/components/masonry)                     |
| 4000–4099 | Query error                       | [Query error](/components/query-error)             |
| 4100–4199 | Floating action                   | [Floating action](/components/floating-action)     |
| 4200–4299 | Filter overlay                    | [Filter overlay](/components/filter-overlay)       |
| 4300–4399 | Match                             | [Match](/components/match)                         |
| 4400–4499 | Standings                         | [Standings](/components/standings)                 |
| 4500–4599 | Scheduler                         | [Scheduler](/components/scheduler)                 |
| 4600–4699 | Tree                              | [Tree](/components/tree)                           |
| 4700–4799 | Color input                       | [Color input](/components/text-inputs#color-input) |
| 4800–4899 | Command palette                   | [Command palette](/components/command-palette)     |
| 4900–4999 | Scrollbar                         | [Scrollbar](/components/scrollbar)                 |
| 5000–5099 | Rating                            | [Choice & rating](/components/choice-inputs)       |
| 5100–5199 | Chart                             | [Chart](/components/chart)                         |
| 5200–5299 | Selection lists                   | [Choice & rating](/components/choice-inputs)       |
| 9000–9099 | Core animations (`@ethlete/core`) | [Animations](/core/animations)                     |

::: info Codes below 1000
Codes below 1000 come from other packages: `@ethlete/query` (see [Query errors](/query/errors#error-codes)) and `@ethlete/contentful` (see [Contentful](/contentful/)). The query web-socket codes `ET1000`/`ET1001` collide with the select codes - the bracketed source in the select messages (`[SelectDirective]`) tells them apart.
:::

## Select (ET10xx)

| Code     | Cause                                                                              | Fix                                                           |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ET1000` | An `[etSelect]` element has no trigger.                                            | Add an element with `etSelectTrigger` inside the select root. |
| `ET1001` | An `[etSelect]` element has no surface template.                                   | Add `<ng-template etSelectSurface>` inside the select root.   |
| `ET1002` | `etSelectTrigger` is not inside an `[etSelect]` element.                           | Move the trigger inside the select root.                      |
| `ET1003` | `etSelectSurface` is not inside an `[etSelect]` element.                           | Move the surface template inside the select root.             |
| `ET1004` | `etSelectListbox` is not rendered inside the surface of an `[etSelect]` element.   | Move the listbox inside the surface template.                 |
| `ET1005` | `etSelectOption` is not inside an `[etSelect]` element.                            | Move the option inside the select root.                       |
| `ET1006` | `etSelectValue` is not inside an `[etSelect]` element.                             | Move the value element inside the select root.                |
| `ET1007` | `etSelectSearch` is not inside an `[etSelect]` element.                            | Move the search input inside the select root.                 |
| `ET1008` | A select state template (empty, loading, …) is not inside an `[etSelect]` element. | Move the `<ng-template>` inside the select root.              |
| `ET1009` | `etSelectOptionGroup` is not inside an `[etSelect]` element.                       | Move the option group inside the select root.                 |
| `ET1010` | `etSelectVirtualOption` is not inside an `[etSelect]` element.                     | Move the virtual option inside the select root.               |
| `ET1011` | `etSelectOptionTemplate` is not inside an `[etSelect]` element.                    | Move the option template inside the select root.              |
| `ET1012` | `etSelectViewport` is not rendered inside the surface of an `[etSelect]` element.  | Move the viewport inside the surface template.                |
| `ET1013` | `etSelectOptions` is not on an `[etSelect]` / `et-select` element.                 | Put `etSelectOptions` on the select element itself.           |
| `ET1014` | `etSelectAllOption` is not inside an `[etSelect]` element.                         | Move the select-all row inside the select root.               |

## Tag input (ET27xx)

| Code     | Cause                                                      | Fix                                       |
| -------- | ---------------------------------------------------------- | ----------------------------------------- |
| `ET2700` | `etTagInputField` is not inside an `[etTagInput]` element. | Move the field inside the tag input root. |

## Phone input (ET28xx)

| Code     | Cause                                                          | Fix                                                 |
| -------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `ET2800` | `etPhoneInputField` is not inside an `[etPhoneInput]` element. | Move the field inside the phone input root.         |
| `ET2801` | `etPhoneInputFlag` is not inside an `[etPhoneInput]` element.  | Move the flag template inside the phone input root. |

## Calendar (ET29xx)

| Code     | Cause                                                     | Fix                                     |
| -------- | --------------------------------------------------------- | --------------------------------------- |
| `ET2900` | `etCalendarGrid` is not inside an `[etCalendar]` element. | Move the grid inside the calendar root. |
| `ET2901` | `etCalendarCell` is not inside an `[etCalendar]` element. | Move the cell inside the calendar root. |

## Date & time inputs (ET30xx)

The date input, date range input, [time picker](/components/time-picker), time input, time range input and date-time input share this block (the picker trigger/surface pieces work with any of the input hosts).

Checked in dev mode only. Every check throws while the directive is constructed, except `ET3003` (thrown when the picker is opened) and `ET3011` / `ET3061` / `ET3071` (thrown when the duplicate field registers).

| Code     | Cause                                                                          | Fix                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ET3000` | `etDateInputField` is not inside an `[etDateInput]` element.                   | Move the field inside the date input root.                                                                                                             |
| `ET3001` | `etDatePickerTrigger` is not inside a date picker host.                        | Move the trigger inside `[etDateInput]`, `[etDateRangeInput]`, `[etTimeInput]`, `[etDateTimeInput]`, `[etTimeRangeInput]` or `[etDateTimeRangeInput]`. |
| `ET3002` | `etDatePickerSurface` is not inside a date picker host.                        | Move the surface template inside any date picker host.                                                                                                 |
| `ET3003` | The picker was opened without an `etDatePickerSurface` template.               | Add `<ng-template etDatePickerSurface>` inside the host element.                                                                                       |
| `ET3010` | `etDateRangeInputField` is not inside an `[etDateRangeInput]` element.         | Move the field inside the date range input root.                                                                                                       |
| `ET3011` | A date range input has two fields for one side.                                | Keep one `etDateRangeInputField` for each `side`.                                                                                                      |
| `ET3022` | `etTimePickerRing` is not inside an `[etTimePicker]` element.                  | Move the ring inside the time picker root.                                                                                                             |
| `ET3023` | `etTimePickerRingHandle` is not inside an `[etTimePickerRing]` element.        | Move the handle inside the ring.                                                                                                                       |
| `ET3030` | `etTimeInputField` is not inside an `[etTimeInput]` element.                   | Move the field inside the time input root.                                                                                                             |
| `ET3040` | `etDateTimeInputField` is not inside an `[etDateTimeInput]` element.           | Move the field inside the date-time input root.                                                                                                        |
| `ET3050` | `etDurationInputField` is not inside an `[etDurationInput]` element.           | Move the field inside the duration input root.                                                                                                         |
| `ET3060` | `etDateTimeRangeInputField` is not inside an `[etDateTimeRangeInput]` element. | Move the field inside the date-time range input root.                                                                                                  |
| `ET3061` | A date-time range input has two fields for one side.                           | Keep one `etDateTimeRangeInputField` for each `side`.                                                                                                  |
| `ET3070` | `etTimeRangeInputField` is not inside an `[etTimeRangeInput]` element.         | Move the field inside the time range input root.                                                                                                       |
| `ET3071` | A time range input has two fields for one side.                                | Keep one `etTimeRangeInputField` for each `side`.                                                                                                      |

## Slider (ET31xx)

| Code     | Cause                                                                                                        | Fix                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `ET3100` | `etSliderThumb` is not inside an `[etSlider]` / `[etRangeSlider]` element.                                   | Move the thumb inside the slider root.                                             |
| `ET3101` | `etSliderTrack` is not inside an `[etSlider]` / `[etRangeSlider]` element.                                   | Move the track inside the slider root.                                             |
| `ET3102` | `ng-template[etSliderThumbLabel]` is not inside an `[etSlider]` / `[etRangeSlider]` element.                 | Move the label template inside the slider root.                                    |
| `ET3103` | The slider has the wrong number of thumbs (`[etSlider]` expects exactly one, `[etRangeSlider]` exactly two). | Add/remove `etSliderThumb` elements, or switch between `etSlider`/`etRangeSlider`. |
| `ET3104` | `marks="true"` would generate more than 200 ticks for the current `step` and bounds.                         | Raise the `step` or pass an explicit `marks` array.                                |

## Cascader (ET33xx)

| Code     | Cause                                                                | Fix                                                               |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ET3300` | An `[etCascader]` element has no trigger.                            | Add an element with `etCascaderTrigger` inside the cascader root. |
| `ET3301` | An `[etCascader]` element has no surface template.                   | Add `<ng-template etCascaderSurface>` inside the cascader root.   |
| `ET3302` | The cascader was opened without a `[dataSource]`.                    | Bind a `CascaderDataSource` to the cascader.                      |
| `ET3303` | `etCascaderTrigger` is not inside an `[etCascader]` element.         | Move the trigger inside the cascader root.                        |
| `ET3304` | `etCascaderSurface` is not inside an `[etCascader]` element.         | Move the surface template inside the cascader root.               |
| `ET3305` | `etCascaderColumn` is not rendered inside an `[etCascader]` element. | Move the column inside the cascader surface.                      |
| `ET3306` | `etCascaderNode` is not rendered inside an `[etCascader]` element.   | Move the node inside a cascader column.                           |
| `ET3307` | `etCascaderSearch` is not inside an `[etCascader]` element.          | Move the search input inside the cascader surface.                |
| `ET3308` | `etCascaderSearchOption` is not inside an `[etCascader]` element.    | Move the search option inside the cascader surface.               |

## Masked input (ET32xx)

| Code     | Cause                                                    | Fix                                                                   |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| `ET3200` | `etInputMask` is not placed on an input control element. | Place the directive on the `et-input` (or `input[etInput]`) it masks. |

## Chip (ET11xx)

| Code     | Cause                                               | Fix                                           |
| -------- | --------------------------------------------------- | --------------------------------------------- |
| `ET1100` | `etChipRemove` is not inside an `[etChip]` element. | Move the remove control inside the chip host. |

## Overlay (ET12xx)

| Code     | Cause                                                                                                 | Fix                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ET1200` | An `[etOverlay]` element has no surface template.                                                     | Add `<ng-template etOverlaySurface>` inside the `[etOverlay]` element.                               |
| `ET1201` | `etOverlayTrigger` is not inside an `[etOverlay]` element.                                            | Move the trigger inside the overlay root.                                                            |
| `ET1202` | `etOverlayAnchor` is not inside an `[etOverlay]` element.                                             | Move the anchor inside the overlay root.                                                             |
| `ET1203` | `etOverlaySurface` is not inside an `[etOverlay]` element.                                            | Move the surface template inside the overlay root.                                                   |
| `ET1204` | Merged overlay strategies each contribute a layout class for the same config key.                     | Overwrite the layout class instead of combining strategies that each provide one.                    |
| `ET1205` | A closest-overlay lookup ran on an element that isn't rendered inside an open overlay.                | Only call it from content rendered inside an overlay.                                                |
| `ET1206` | An overlay contains nested `<et-overlay-main>` elements or `etOverlayMain` directives.                | Keep exactly one main region per overlay.                                                            |
| `ET1207` | An overlay definition's `injectRef()` was called outside a component opened via that definition.      | Call it only inside the component the definition opens.                                              |
| `ET1208` | An `et-overlay-header`, `et-overlay-body`, or `et-overlay-footer` has no `etOverlayMain` ancestor.    | Wrap them in an `<et-overlay-main>` element or a host carrying the `etOverlayMain` directive.        |
| `ET1209` | The full-screen enter animation ran without an origin element to grow out of.                         | Pass `origin` in the overlay config (the strategy otherwise uses its reduced animation).             |
| `ET1210` | The `strategies` factory returned an empty array, so the overlay has no strategy to open with.        | Return at least one entry, including one without a `breakpoint` as the base strategy.                |
| `ET1211` | An overlay was opened with `directives` or `customAnimated` but without `strategies` (dev mode only). | Add a `strategies` entry - only the strategy container applies those options - or remove the option. |

## Menu (ET13xx)

| Code     | Cause                                                                                                                          | Fix                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ET1300` | An `[etMenu]` element has no surface template.                                                                                 | Add `<ng-template etMenuSurface>` inside the `[etMenu]` element.                                           |
| `ET1301` | `etMenuTrigger` is not inside an `[etMenu]` element.                                                                           | Move the trigger inside the menu root.                                                                     |
| `ET1302` | `etMenuSurface` is not inside an `[etMenu]` element.                                                                           | Move the surface template inside the menu root.                                                            |
| `ET1303` | `etMenuItem` is not rendered inside a menu surface, or `etMenuSelectionItem` is used without `etMenuItem` on the same element. | Render items inside the surface; for submenu triggers, nest the `[etMenu]` element inside the parent menu. |
| `ET1304` | `etMenuPanel` is not rendered inside a menu surface.                                                                           | Move the panel inside the surface template.                                                                |
| `ET1305` | `etMenuSearch` is not rendered inside a menu surface.                                                                          | Move the search input inside the surface template.                                                         |
| `ET1306` | `etMenuContextTrigger` is not inside an `[etMenu]` element.                                                                    | Move the context trigger inside the menu root.                                                             |
| `ET1307` | `etMenuContextTrigger` is placed on a submenu.                                                                                 | Context triggers can only open root menus - move it to the outermost `[etMenu]` element.                   |
| `ET1320` | A selection item inside a selection group has no value.                                                                        | Add a `[value]` input to the `etMenuSelectionItem`.                                                        |
| `ET1321` | A radio item is used without a surrounding selection group.                                                                    | Wrap radio items in an `et-menu-radio-group`.                                                              |

## Tooltip (ET14xx)

| Code     | Cause                                             | Fix                                                                               |
| -------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ET1400` | A template tooltip has no accessible description. | Add `etTooltipAriaDescription` so non-visual users get an equivalent description. |

## Toggletip (ET15xx)

| Code     | Cause                                                                  | Fix                                                                            |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ET1500` | A template toggletip has no accessible name.                           | Add `etToggletipAriaLabel` or `etToggletipAriaLabelledBy`.                     |
| `ET1501` | `etToggletipTrigger` is used on an element without a button directive. | Apply it to an element that also has a button directive such as `[et-button]`. |
| `ET1502` | `etToggletipTrigger` is not on the same element as `[etToggletip]`.    | Put both directives on the same element.                                       |

## Stream (ET16xx)

| Code     | Cause                                                                                                           | Fix                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ET1600` | The configured consent component doesn't provide the stream consent token.                                      | Add `hostDirectives: [StreamConsentDirective]` to the consent component.                          |
| `ET1601` | A platform SDK script failed to load.                                                                           | Check the URL and network - ad blockers commonly block player SDKs.                               |
| `ET1602` | The Twitch Embed SDK loaded but its global isn't available.                                                     | Ensure the Twitch Embed SDK URL is accessible and not rewritten.                                  |
| `ET1603` | The YouTube IFrame API loaded but `YT.Player` isn't available.                                                  | Ensure the YouTube IFrame API URL is accessible and not rewritten.                                |
| `ET1604` | The configured PiP chrome component doesn't provide the PiP chrome token.                                       | Implement `PipChromeRef` and provide `PIP_CHROME_REF_TOKEN` with `useExisting`.                   |
| `ET1605` | The Facebook SDK loaded but its global isn't available.                                                         | Ensure the Facebook SDK URL is accessible and not rewritten.                                      |
| `ET1606` | The Vimeo Player SDK isn't available, or the player failed to become ready.                                     | Ensure the Vimeo SDK URL is accessible; the message contains the underlying failure.              |
| `ET1607` | The TikTok player reported an error.                                                                            | The message contains the platform's error value; the video may be unavailable.                    |
| `ET1608` | A Facebook video didn't become ready in time.                                                                   | The video may be unavailable or restricted.                                                       |
| `ET1609` | The YouTube player reported an error.                                                                           | The message contains the YouTube error code; the video may be removed, private or not embeddable. |
| `ET1610` | `et-pip-player` has neither an `entry` input nor a parent `etPipCell`.                                          | Bind `[entry]`, or render it inside an `etPipCell`.                                               |
| `ET1611` | A SOOP or Twitch slot resolved no source: no `userId`/`videoId`, or a Twitch `src` that is no channel or video. | Set a valid source. The slot shows its error overlay instead of a spinner that never ends.        |
| `ET1612` | `pipActivate()` / `pipDeactivate()` was called on a slot without picture-in-picture. Dev mode only.             | Add `provideStreamPip()` to the injector the slot is created in.                                  |

## Notification (ET17xx)

| Code     | Cause                                                                       | Fix                                                 |
| -------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| `ET1700` | `etNotificationAction` is not inside an `[etNotification]` element.         | Move the action inside the notification.            |
| `ET1701` | `etNotificationDismiss` is not inside an `[etNotification]` element.        | Move the dismiss button inside the notification.    |
| `ET1702` | `etNotificationSwipeToDismiss` is not inside an `[etNotification]` element. | Put the gesture on the notification element itself. |

## Icon (ET18xx)

| Code     | Cause                                                                   | Fix                                                                                           |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ET1800` | `[etIcon]` is used but no icons are registered.                         | Register icons via `provideIcons()` in component or application providers.                    |
| `ET1801` | The requested icon name (or name/variant combination) isn't registered. | The message lists all available icons - register the missing one or fix the name.             |
| `ET1802` | The registered icon data contains no `<svg>` element.                   | Provide valid SVG markup.                                                                     |
| `ET1803` | The icon's `<svg>` is missing `xmlns="http://www.w3.org/2000/svg"`.     | Add the attribute - it's required for `innerHTML`-based rendering.                            |
| `ET1804` | The icon's `<svg>` is missing `width="100%"` and/or `height="100%"`.    | Add both attributes so the icon scales with its host.                                         |
| `ET1805` | The icon uses a hardcoded `fill`/`stroke` color.                        | Use `currentColor` so the icon follows the text color, or set `[allowHardcodedColor]="true"`. |
| `ET1806` | Two icons were registered with the same name/variant combination.       | Make every name/variant combination unique.                                                   |

`ET1802`–`ET1805` are dev-mode-only SVG validations; `ET1800`/`ET1801` are raised in production too. `ET1800` throws while the icon is created, and `ET1806` throws in every build while the icon providers are resolved; `ET1801`–`ET1805` go to the `ErrorHandler`, and the icon renders empty.

## Grid (ET19xx)

All grid checks run in dev mode only.

| Code     | Cause                                                                                                    | Fix                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ET1900` | `etGridItem` is not inside an `[etGrid]` element.                                                        | Render items inside the grid (e.g. `et-grid`).                                                                             |
| `ET1901` | `etGridDrag` / `etGridResize` is used outside an `[etGridItem]` element.                                 | Place the handle on or inside a grid item.                                                                                 |
| `ET1902` | Two grid item configs share the same `id`.                                                               | Make item ids unique; the offending configs are logged alongside the error.                                                |
| `ET1903` | `restoreState()` received a state with breakpoint names that aren't configured.                          | Align the serialized state's breakpoints with the grid's `breakpoints` input.                                              |
| `ET1904` | Nothing renders an item: its `type` has no registration and no projected `et-grid-item` covers it.       | Register the type via `provideGridConfig()` (the message lists the registered types), or project an `et-grid-item` for it. |
| `ET1905` | An item is rendered twice - its `type` has a registration and a projected `et-grid-item` also covers it. | Project only the items whose type is unregistered; the offending ids are logged alongside the error.                       |

## Tabs (ET20xx)

All tabs checks run in dev mode only.

| Code     | Cause                                                                                                                   | Fix                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ET2000` | A tab trigger has no enclosing tab bar.                                                                                 | Place it inside `et-tab-group`, `et-nav-tabs`, or an `[etTabBar]` element.   |
| `ET2001` | `<et-tab>` or `etTabPanel` is outside a tab group (an orphan `<et-tab>` renders nothing).                               | Move it inside `et-tab-group` / an `[etTabGroup]` element.                   |
| `ET2002` | A headless tab group has triggers but no registered `etTabPanel`.                                                       | Add a panel per tab.                                                         |
| `ET2003` | `a[et-nav-tab-link]` or `et-nav-tabs-outlet` is used without an `et-nav-tabs` element.                                  | Add the `et-nav-tabs` bar (links go inside it; the outlet can be a sibling). |
| `ET2004` | Warning: a sibling `et-nav-tabs-outlet` sits next to more than one `et-nav-tabs` element and gets no `aria-labelledby`. | Place the outlet inside its `et-nav-tabs`.                                   |

## Scrollable (ET21xx)

| Code     | Cause                                                | Fix                                                                   |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `ET2100` | A headless `[etScrollable]` has no scroll container. | Use `<et-scrollable>`; headless `[etScrollable]` does not create one. |

## Form field (ET22xx)

| Code     | Cause                                                                                    | Fix                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ET2200` | An `<et-form-field>` wraps a field of its own (e.g. `<et-rating>`) instead of a control. | Remove the outer `<et-form-field>` and project the `<et-label>` and `<et-hint>` into the inner field.          |
| `ET2201` | An `<et-form-field>` control has no accessible name (no label and no aria attribute).    | Project an `<et-label>`, or set `aria-label` / `aria-labelledby` on the control. A placeholder is not a label. |

## Split button (ET23xx)

All split button checks run in dev mode only.

| Code     | Cause                                                              | Fix                                                           |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `ET2300` | An `[etSplitButton]` element has no action segment.                | Add a button with the `etSplitButtonAction` directive.        |
| `ET2301` | An `[etSplitButton]` element has no trigger segment.               | Add a button with the `etSplitButtonTrigger` directive.       |
| `ET2302` | `etSplitButtonAction` is not inside an `[etSplitButton]` element.  | Move the action inside the split button (`et-split-button`).  |
| `ET2303` | `etSplitButtonTrigger` is not inside an `[etSplitButton]` element. | Move the trigger inside the split button (`et-split-button`). |
| `ET2304` | An `[etSplitButton]` element has more than one action segment.     | Remove the extra `etSplitButtonAction` buttons.               |
| `ET2305` | An `[etSplitButton]` element has more than one trigger segment.    | Remove the extra `etSplitButtonTrigger` buttons.              |

## Dropzone (ET24xx)

All dropzone checks run in dev mode only.

| Code     | Cause                                                                                | Fix                                                                                  |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `ET2400` | The `upload` input is not a valid config (missing `queryCreator` or `selectValue`).  | Create the config via `createDropzoneUpload({ queryCreator, selectValue, ... })`.    |
| `ET2401` | The control was initialized with a value but the config has no `resolveExisting`.    | Add a `resolveExisting` function so existing values can be displayed.                |
| `ET2402` | The control value shape doesn't match the mode (array in single mode or vice versa). | Set `multiple` to match the value shape, or write a value matching the current mode. |

## Rich text editor (ET25xx)

All rich text editor checks run in dev mode only, and cover the opt-in `etRichTextEditorTriggers` building blocks and the opt-in tool providers.

| Code     | Cause                                                                                | Fix                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ET2500` | Two triggers share the same `char`.                                                  | Give each trigger a unique trigger character.                                                                                        |
| `ET2501` | Two triggers share the same `type`.                                                  | Give each trigger a unique type.                                                                                                     |
| `ET2502` | A trigger `type` is malformed.                                                       | Match `[a-z][a-z0-9-]*` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown.                                    |
| `ET2503` | An item `id` is malformed.                                                           | Match `[A-Za-z0-9._:-]+` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown.                                   |
| `ET2504` | `etRichTextEditorTriggers` is on an element without `etRichTextEditor`.              | Place it on the editor element (e.g. `<et-rich-text-editor>`).                                                                       |
| `ET2505` | `insertToken`/`insertTokenItem` called with no token codec installed.                | Add `etRichTextEditorTriggers` or `provideRichTextEditorTokenRendering(triggers)`.                                                   |
| `ET2506` | A command was called whose tool is not provided (the message names it).              | Add the named provider - e.g. `provideRichTextEditorLinkTool()` - or `provideRichTextEditorDefaultTools()` for the full default set. |
| `ET2507` | `RICH_TEXT_EDITOR_TOOL` was provided without `multi: true`.                          | Register the tool with `provideRichTextEditorTool(definition)`.                                                                      |
| `ET2508` | A trigger `char` is not exactly one character (e.g. a two-character string or `''`). | Use a single trigger character such as `'#'` or `'@'`.                                                                               |

## Multi-language rich text editor (ET26xx)

These are reported through the `ErrorHandler` rather than thrown; the editor renders nothing while `ET2600` or `ET2601` is set.

| Code     | Cause                                                                                            | Fix                                                                           |
| -------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `ET2600` | The `languages` input is empty.                                                                  | Pass at least one `{ code, label }`.                                          |
| `ET2601` | Two languages share the same `code`.                                                             | Give each language a unique code.                                             |
| `ET2602` | The `'language'` switcher tool rendered outside an `[etMultiLanguageRichTextEditor]` (dev mode). | Use `<et-multi-language-rich-text-editor>`, which places the switcher itself. |

## Bracket (ET34xx)

Runtime errors from the bracket data pipeline and layout engine. They indicate a malformed or unsupported `BracketDataSource` rather than a template-placement mistake. The data pipeline throws them as `BracketRuntimeError` (exported, with a numeric `code`); `ET3412`-`ET3414` are core `RuntimeError`s.

| Code     | Cause                                                                                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ET3401` | The source has no rounds to render.                                                                                                          | Provide a `BracketDataSource` with rounds; render `<et-bracket-skeleton>` until the stage has some. `generateBracketDataForEthlete` maps a stage with rounds and no matches (pass `{ mode }` for a swiss stage).                                                                                                                                                                                          |
| `ET3402` | An integration received an unsupported tournament mode.                                                                                      | Use a supported mode (`single-elimination`, `double-elimination`, `swiss-with-elimination`).                                                                                                                                                                                                                                                                                                              |
| `ET3403` | Two rounds in the source share an id.                                                                                                        | Give every round a unique `id`.                                                                                                                                                                                                                                                                                                                                                                           |
| `ET3404` | Two matches in the source share an id.                                                                                                       | Give every match a unique `id`.                                                                                                                                                                                                                                                                                                                                                                           |
| `ET3405` | A round-to-round relation couldn't be resolved (malformed round structure).                                                                  | Give the mode the rounds it needs: at least one round with matches outside the lower bracket, and at least two lower-bracket rounds for a double elimination. Rounds with no matches are linked over, not counted.                                                                                                                                                                                        |
| `ET3406` | A match-to-match relation couldn't be resolved: a match names a `roundId` that is not in `source.rounds`, or the match counts don't line up. | Make every match `roundId` reference an existing round (the message names both). Give each round the match count the mode implies for the round it feeds - an empty round is linked over, so the counts either side of it are the ones that must line up - and list rounds and matches in [bracket order](/components/bracket#data-source). Or declare `homeSource`/`awaySource` and skip the count math. |
| `ET3407` | The computed layout grid ended up in an inconsistent state.                                                                                  | Check the round types and match counts against the mode's expected structure.                                                                                                                                                                                                                                                                                                                             |
| `ET3408` | Swiss groups couldn't be generated from the source.                                                                                          | Past the fifth round the model has no win/loss group left (3 wins advance, 3 losses eliminate), so a later round whose matches all carry no participants has nowhere to go. Trim the stage, or give those matches participants.                                                                                                                                                                           |
| `ET3409` | A swiss group ended up empty while round headers are enabled.                                                                                | Populate every available win/loss group, or hide round headers.                                                                                                                                                                                                                                                                                                                                           |
| `ET3410` | A match's resolved winner id isn't among its participants.                                                                                   | Set `winner` to `'home'`/`'away'`/`null` matching the match's `home`/`away`.                                                                                                                                                                                                                                                                                                                              |
| `ET3411` | A required key was missing from an internal bracket lookup.                                                                                  | An internal inconsistency rather than bad data - report it as a bug, with the source that triggers it.                                                                                                                                                                                                                                                                                                    |
| `ET3412` | The default cards are rendering but no `matchNormalizer` was registered.                                                                     | Add `provideBracketConfig({ matchNormalizer })` - the Ethlete feed ships `normalizeEthleteBracketMatch` - or supply your own cards.                                                                                                                                                                                                                                                                       |
| `ET3413` | No registered bracket layout matches the source's tournament `mode`.                                                                         | Add the mode's factory (e.g. `doubleEliminationBracketLayout()`) to `provideBracketConfig({ layouts })` or to the `layouts` input.                                                                                                                                                                                                                                                                        |
| `ET3414` | A cell the bracket draws has no card.                                                                                                        | Spread `BRACKET_DEFAULT_CARDS` into `provideBracketConfig({ ... })`, or bind a match and a round header card of your own - plus a continue card while `showContinueElement` is on.                                                                                                                                                                                                                        |
| `ET3415` | `createPlaceholderBracketSource` got an unusable `participantCount`.                                                                         | Pass a power of two - at least 2 for single elimination, at least 4 for double elimination.                                                                                                                                                                                                                                                                                                               |

## Table (ET35xx)

| Code     | Cause                                                                                 | Fix                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ET3501` | A table feature (e.g. `etTableFilters`) was used outside an `<et-table>`.             | Put the feature attribute on the `<et-table>` element itself.                                                                                                                  |
| `ET3502` | Two features tried to window the rows (e.g. two virtual-scroll features).             | Use only one row-windowing feature per table.                                                                                                                                  |
| `ET3503` | An `etTableCell` / `etTableHeaderCell` / `etTableFooterCell` sits outside a table.    | Move the `<ng-template>` inside the `<et-table>` whose column it renders.                                                                                                      |
| `ET3504` | A column template is bound to a column this table doesn't render.                     | Bind it to a column of the same `columns` record, e.g. `[etTableCell]="COLUMNS.role"`.                                                                                         |
| `ET3505` | A CSV export named a column key the table doesn't declare.                            | Check the key against the `columns` record, or drop the `columns` option to take the visible ones.                                                                             |
| `ET3506` | A CSV export would write fewer rows than the table's source says exist.               | Pass `rows` (a list or a provider such as `tableCsvRowsFromPages`), `file` for a server-built export, or `partial: true` to write the loaded page on purpose.                  |
| `ET3507` | A CSV export was given `file` together with options for building one.                 | The server already wrote that file - drop `rows`/`columns`/`header`/`delimiter`/`formulaGuard`/`bom`, or drop `file`.                                                          |
| `ET3508` | An `expandedRowTemplate` is bound, but nothing renders it.                            | Add `etTableRowExpansion` to the table and import `TABLE_ROW_EXPANSION_IMPORTS` - see [Row expansion](/components/table#row-expansion).                                        |
| `ET3509` | A `rowLink` answered with router commands, but nothing resolves them.                 | Add `etTableRowRouterLink` and import `TABLE_ROW_ROUTER_LINK_IMPORTS`, or answer with an `href` string - see [Row links](/components/table#row-links).                         |
| `ET3510` | A `rowsSource` publishes `sort`/`filters` without the setter to write them.           | Add `setSort`/`setFilters`, or drop the signal and let the table own it - see [One binding instead of six](/components/table#one-binding-instead-of-six).                      |
| `ET3511` | `pinColumn()` was called on a table without `etTableStickyColumns`.                   | Add `etTableStickyColumns` and import `TABLE_STICKY_COLUMNS_IMPORTS` - see [Pinning at runtime](/components/table#pinning-at-runtime).                                         |
| `ET3512` | A column sets `filterable`, `sticky`, `group` or `editable`, but no feature reads it. | Add the directive the message names (`etTableFilters`, `etTableStickyColumns`, `etTableGroupHeaders`, `etTableInlineEdit`) and import its `TABLE_*_IMPORTS`, or drop the flag. |
| `ET3513` | A CSV export read an object, list or function from a column with no `exportValue`.    | Add `exportValue` to the column - see [What each cell says](/components/table#what-each-cell-says).                                                                            |

`ET3500` is retired: it flagged duplicate column keys, which the keyed
`TableColumns` record makes impossible.

## Accordion (ET36xx)

All accordion checks run in dev mode only, after the first render.

| Code     | Cause                                                                                               | Fix                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ET3600` | An `etAccordionTrigger`, `etAccordionPanel` or slot template sits outside an accordion.             | Move it inside the `[etAccordion]` element (e.g. `<et-accordion>`) it belongs to.               |
| `ET3601` | An accordion rendered no `etAccordionTrigger`, so nothing can expand it.                            | Add a trigger - ideally a `<button etAccordionTrigger>` inside a heading.                       |
| `ET3602` | An accordion is open but has no `etAccordionPanel`.                                                 | Add an `etAccordionPanel` element, or render it conditionally only while the accordion is open. |
| `ET3603` | `openAll()` was called on a group with `autoCloseOthers` on, so it did nothing. A dev-mode warning. | Turn `autoCloseOthers` off before expanding every accordion.                                    |

## Breadcrumb (ET37xx)

All breadcrumb checks run in dev mode only, after the first render.

| Code     | Cause                                                                                                                                     | Fix                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ET3700` | An `etBreadcrumbItemTemplate` or `etBreadcrumbSeparator` sits outside a breadcrumb.                                                       | Move the `<ng-template>` inside the `[etBreadcrumb]` element it belongs to.                                        |
| `ET3701` | A breadcrumb has no crumb templates, so there is no trail to render.                                                                      | Declare one `<ng-template etBreadcrumbItemTemplate>` per crumb.                                                    |
| `ET3702` | `etBreadcrumbSeo` reaches neither an `etBreadcrumb` on its element nor a breadcrumb manager.                                              | Put it on the `[etBreadcrumb]` element, or on `<et-breadcrumb-outlet>` with `provideBreadcrumbManager()` in scope. |
| `ET3703` | Something other than an `etBreadcrumbSeparator` template was projected into `<et-breadcrumb-outlet>`, which drops it. A dev-mode warning. | Contribute crumbs from an `<ng-template etBreadcrumbSegment>` instead.                                             |
| `ET3704` | A second `<et-breadcrumb-outlet>` renders the same breadcrumb manager, so every crumb shows twice. A dev-mode warning.                    | Render one outlet per manager.                                                                                     |

## Carousel (ET38xx)

All carousel checks run in dev mode only.

| Code     | Cause                                                                                    | Fix                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ET3800` | A slide template, slide, control or `etCarouselAutoplay` sits outside an `[etCarousel]`. | Move it inside the carousel element - controls included, since they resolve it upwards. |
| `ET3801` | The carousel has children but none of them is an `etCarouselItem`.                       | Add the directive to each slide, so it can label them and track the current one.        |
| `ET3802` | Autoplay is on with no control to pause it (WCAG 2.2.2).                                 | Add a button with `etCarouselPlayToggle`, or use `<et-carousel>`, which renders one.    |
| `ET3803` | `etCarousel` found no scrollable to move.                                                | Put it on, or around, an `[etScrollable]` element (or use `<et-carousel>`).             |
| `ET3804` | `<et-carousel>` was given no `etCarouselSlide` template.                                 | Add one: `<ng-template [etCarouselSlide]="slides()" let-slide>…</ng-template>`.         |

## Masonry (ET39xx)

All masonry checks run in dev mode only.

| Code     | Cause                                                            | Fix                                                                                          |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ET3900` | An `etMasonryItem` sits outside an `[etMasonry]` element.        | Move it inside the masonry, which is what measures and positions it.                         |
| `ET3901` | The masonry has children but none of them is an `etMasonryItem`. | Add the directive to each child - without it nothing positions them and they stay invisible. |

## Query error (ET40xx)

All query-error checks run in dev mode only, after the first render.

| Code     | Cause                                                                                | Fix                                                                         |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `ET4000` | An `etQueryErrorTitle` or `etQueryErrorActions` template sits outside a query error. | Move the `<ng-template>` inside the `[etQueryError]` element it belongs to. |

## Floating action (ET41xx)

All floating-action checks run in dev mode only, after the first render.

| Code     | Cause                                                                | Fix                                                                             |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ET4100` | A floating-action part sits outside an `[etFloatingAction]` element. | Move it inside the coordinator element it belongs to.                           |
| `ET4101` | A floating action has no `[etFloatingActionAnchor]`.                 | Wrap the trigger in an anchor element - it is what reports the scroll position. |

## Filter overlay (ET42xx)

Checked in dev mode only, after the first render.

| Code     | Cause                                                                                | Fix                                                                                               |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `ET4200` | An `etFilterOverlaySubmit` or `etFilterOverlayReset` has no filter overlay above it. | Add `provideFilterOverlay({ … })` to the providers of the overlay component the control lives in. |

## Match (ET43xx)

Checked in dev mode only, after the first render.

| Code     | Cause                                                                                                | Fix                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ET4300` | An `etMatchCardScore`, `etMatchCardMeta` or `etMatchCardGameScores` has no `[etMatchCard]` above it. | Move the part inside the card element (`<et-match-card>` or your own `etMatchCard`). |

## Standings (ET44xx)

Checked in dev mode only.

| Code     | Cause                                                         | Fix                                             |
| -------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `ET4400` | Two `zones` cover the same position, so a row is in both.     | Give every zone its own `from`–`to` range.      |
| `ET4401` | A second `ng-template[etStandingsPickMark]` in one pick list. | Keep one mark template per `et-standings-pick`. |

## Scheduler (ET45xx)

ET4500 and ET4502-ET4504 throw on creation in all builds. ET4501, ET4505 and ET4506 are reported in dev mode only.

| Code     | Cause                                                                                                           | Fix                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ET4500` | An opt-in scheduler feature is used outside an `<et-scheduler>`.                                                | Move the feature inside the scheduler root.                |
| `ET4501` | A view layout directive (e.g. `[etSchedulerMonth]`) is placed outside an `[etScheduler]`.                       | Move it inside the scheduler root.                         |
| `ET4502` | An edit-surface feature (an edit field or appointment action) is used outside an `<et-scheduler-edit-surface>`. | Move it inside the edit surface root.                      |
| `ET4503` | `[etSchedulerSwipeNavigation]` is placed on an element that is not an `[etScheduler]`.                          | Move it onto the scheduler root.                           |
| `ET4504` | `[etSchedulerAppointmentDrag]` is placed on an element that is not an `[etScheduler]`.                          | Move it onto the scheduler root.                           |
| `ET4505` | `addAppointment()` was called, or a draft range was committed, without a registered default edit surface.       | Add `provideSchedulerEditSurface()` to a parent injector.  |
| `ET4506` | A `businessHours` entry has a time that is not `HH:mm`, or ends before it starts.                               | Fix the entry; `24:00` is the only valid end past `23:59`. |

## Tree (ET46xx)

Checked in dev mode only, after the first render.

| Code     | Cause                                                                      | Fix                                                  |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ET4600` | An `[etTree]` was rendered without a `[dataSource]`.                       | Bind an object with a `loadChildren(parent)` method. |
| `ET4601` | A tree part (`etTreeNode`, `etTreeNodeDef`) is used outside an `[etTree]`. | Move it inside the tree root (e.g. `<et-tree>`).     |

## Color input (ET47xx)

Checked in dev mode only, after the first render - except `ET4704`, which is thrown when the picker
is asked to open.

| Code     | Cause                                                                            | Fix                                                      |
| -------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `ET4700` | `etColorPickerTrigger` is used outside an `[etColorInput]`.                      | Move the button inside the color input element.          |
| `ET4701` | `etColorPickerSurface` is used outside an `[etColorInput]`.                      | Move the template inside the color input element.        |
| `ET4702` | `etColorPickerArea` is used outside an `[etColorInput]`.                         | Move the surface inside the color input element.         |
| `ET4703` | `etColorPickerChannel` is used outside an `[etColorInput]`.                      | Move the range input inside the color input element.     |
| `ET4704` | The picker was opened without an `<ng-template etColorPickerSurface>` to render. | Add the surface template inside the color input element. |

## Command palette (ET48xx)

Checked in dev mode only - `ET4800` after the first render, `ET4801` when the directive is created.

| Code     | Cause                                                                  | Fix                                                |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `ET4800` | `etCommandPaletteSearch` is used outside an `[etCommandPalette]`.      | Move the input inside the command palette element. |
| `ET4801` | `etCommandPaletteShortcut` was given a chord of modifiers with no key. | Add a key to the chord, for example `mod+k`.       |

## Selection lists (ET52xx)

Checked in dev mode only, while the option is constructed.

| Code     | Cause                                                                  | Fix                                                 |
| -------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| `ET5200` | An `et-radio` is not inside an `et-radio-group`.                       | Wrap the radios in an `et-radio-group`.             |
| `ET5201` | An `et-checkbox-option` is not inside an `et-checkbox-group`.          | Wrap the options in an `et-checkbox-group`.         |
| `ET5202` | An `et-segmented-button` is not inside an `et-segmented-button-group`. | Wrap the buttons in an `et-segmented-button-group`. |

## Rating (ET50xx)

| Code     | Cause                                                      | Fix                                         |
| -------- | ---------------------------------------------------------- | ------------------------------------------- |
| `ET5000` | An `et-rating` contains multiple `etRatingIcon` templates. | Keep one `ng-template[etRatingIcon]` child. |

## Scrollbar (ET49xx)

Checked in dev mode only - `ET4900` whenever `for` changes, `ET4901` and `ET4902` after the first render.

| Code     | Cause                                                                       | Fix                                                                     |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ET4900` | `for` was bound to something that is not an element - a component instance. | Bind a template reference variable on the element, or its `ElementRef`. |
| `ET4901` | An `[etScrollbar]` rendered with nothing marked `etScrollbarThumb`.         | Add the thumb element inside the scrollbar.                             |
| `ET4902` | An `[etScrollbar]` rendered with no `for`.                                  | Bind `for` to the element that scrolls.                                 |

## Chart (ET51xx)

Checked in dev mode only, after the first render.

| Code     | Cause                                                                                                            | Fix                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ET5100` | A chart such as `[etBarChart]` rendered with nothing marked `etChartPlot`.                                       | Add `etChartPlot` to the element the marks are laid out in.                      |
| `ET5120` | A `[etLineChart]` has data that mixes `Date` and string `x` values.                                              | Give every datum a `Date` for a time axis, or a string for categories.           |
| `ET5121` | A `[etLineChart]` has a `timeZone` that is not an IANA time zone. The axis falls back to the viewer's time zone. | Pass an IANA name such as `Europe/Berlin`, or `null` for the viewer's zone.      |
| `ET5140` | A `[etPieChart]` datum has a negative or non-finite `value`. A dev-mode warning: the slice counts as 0.          | Pass only parts of a whole - drop or fix the value before handing the data over. |
| `ET5160` | The links of a `[etSankeyChart]` form a cycle. Checked on every layout.                                          | Remove a link that leads back to an earlier node.                                |
| `ET5161` | A `[etSankeyChart]` link names a `source` or `target` that is no node's `id`. Checked on every layout.           | Add the node, or fix the link's id.                                              |
| `ET5162` | Two `[etSankeyChart]` nodes share one `id`. Checked on every layout.                                             | Give every node its own `id`.                                                    |
| `ET5163` | A `[etSankeyChart]` link has a negative or non-finite `value`. Checked on every layout.                          | Pass flows of `0` or more.                                                       |

## Core animations (ET90xx)

Thrown by `@ethlete/core`, in every build.

| Code     | Cause                                                                                | Fix                                                                                    |
| -------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `ET9000` | `*etAnimatedIf` has no `[etAnimatedLifecycle]` element around it to animate against. | Wrap it in an element with `etAnimatedLifecycle` - see [Animations](/core/animations). |
