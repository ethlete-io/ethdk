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
- **Runtime failures** (an icon name that isn't registered, a player SDK that fails to load) throw in production too.

Each domain owns a 100-code block. The codes are exported per domain (e.g. `MENU_ERROR_CODES`, `OVERLAY_ERROR_CODES`) if you need to match on them programmatically.

| Range     | Domain             | Guide                                              |
| --------- | ------------------ | -------------------------------------------------- |
| 1000–1099 | Select             | [Select](/components/select)                       |
| 1100–1199 | Chip               | [Chip](/components/chip)                           |
| 1200–1299 | Overlay            | [Overlays](/components/overlays)                   |
| 1300–1399 | Menu               | [Menu](/components/menu)                           |
| 1400–1499 | Tooltip            | [Tooltip](/components/tooltip)                     |
| 1500–1599 | Toggletip          | [Toggletip](/components/toggletip)                 |
| 1600–1699 | Stream             | [Stream](/components/stream)                       |
| 1700–1799 | Notification       | [Notification](/components/notification)           |
| 1800–1899 | Icon               | [Icon](/components/icon)                           |
| 1900–1999 | Grid               | [Grid](/components/grid)                           |
| 2000–2099 | Tabs               | [Tabs](/components/tabs)                           |
| 2100–2199 | Scrollable         | [Scrollable](/components/scrollable)               |
| 2200–2299 | Form field         | [Forms](/components/forms)                         |
| 2300–2399 | Split button       | [Button](/components/button)                       |
| 2400–2499 | Dropzone           | [Dropzone](/components/dropzone)                   |
| 2500–2599 | Rich text editor   | [Rich text editor](/components/rich-text-editor)   |
| 2700–2799 | Tag input          | [Text inputs](/components/text-inputs)             |
| 2800–2899 | Phone input        | [Text inputs](/components/text-inputs)             |
| 2900–2999 | Calendar           | [Calendar](/components/calendar)                   |
| 3000–3099 | Date & time inputs | [Date & time inputs](/components/date-time-inputs) |
| 3100–3199 | Slider             | [Slider](/components/slider)                       |
| 3200–3299 | Masked input       | [Text inputs](/components/text-inputs)             |
| 3300–3399 | Cascader           | [Cascader](/components/cascader)                   |
| 3400–3499 | Bracket            | [Bracket](/components/bracket)                     |
| 3500–3599 | Table              | [Table](/components/table)                         |
| 3600–3699 | Accordion          | [Accordion](/components/accordion)                 |
| 3700–3799 | Breadcrumb         | [Breadcrumb](/components/breadcrumb)               |
| 3800–3899 | Carousel           | [Carousel](/components/carousel)                   |
| 3900–3999 | Masonry            | [Masonry](/components/masonry)                     |
| 4000–4099 | Query error        | [Query error](/components/query-error)             |
| 4100–4199 | Floating action    | [Floating action](/components/floating-action)     |
| 4200–4299 | Filter overlay     | [Filter overlay](/components/filter-overlay)       |
| 4300–4399 | Match              | [Match](/components/match)                         |
| 4400–4499 | Standings          | [Standings](/components/standings)                 |
| 4500–4599 | Scheduler          | [Scheduler](/components/scheduler)                 |
| 4600–4699 | Tree               | [Tree](/components/tree)                           |
| 4700–4799 | Color input        | [Color input](/components/text-inputs#color-input) |
| 5000–5099 | Rating             | [Choice & rating](/components/choice-inputs)       |

::: info Codes below 1000
Codes `0`–`1001` also appear in `@ethlete/query` (query features, auth, web sockets). `ET1000`/`ET1001` therefore exist in both packages - the bracketed source in the message (`[SelectDirective]` vs. a query feature) tells them apart.
:::

## Select (ET10xx)

| Code     | Cause                                                                            | Fix                                                           |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ET1000` | An `[etSelect]` element has no trigger.                                          | Add an element with `etSelectTrigger` inside the select root. |
| `ET1001` | An `[etSelect]` element has no surface template.                                 | Add `<ng-template etSelectSurface>` inside the select root.   |
| `ET1002` | `etSelectTrigger` is not inside an `[etSelect]` element.                         | Move the trigger inside the select root.                      |
| `ET1003` | `etSelectSurface` is not inside an `[etSelect]` element.                         | Move the surface template inside the select root.             |
| `ET1004` | `etSelectListbox` is not rendered inside the surface of an `[etSelect]` element. | Move the listbox inside the surface template.                 |
| `ET1005` | `etSelectOption` is not inside an `[etSelect]` element.                          | Move the option inside the select root.                       |
| `ET1009` | `etSelectOptionGroup` is not inside an `[etSelect]` element.                     | Move the option group inside the select root.                 |

## Tag input (ET27xx)

| Code     | Cause                                                      | Fix                                       |
| -------- | ---------------------------------------------------------- | ----------------------------------------- |
| `ET2700` | `etTagInputField` is not inside an `[etTagInput]` element. | Move the field inside the tag input root. |

## Phone input (ET28xx)

| Code     | Cause                                                          | Fix                                         |
| -------- | -------------------------------------------------------------- | ------------------------------------------- |
| `ET2800` | `etPhoneInputField` is not inside an `[etPhoneInput]` element. | Move the field inside the phone input root. |

## Calendar (ET29xx)

| Code     | Cause                                                     | Fix                                     |
| -------- | --------------------------------------------------------- | --------------------------------------- |
| `ET2900` | `etCalendarGrid` is not inside an `[etCalendar]` element. | Move the grid inside the calendar root. |
| `ET2901` | `etCalendarCell` is not inside an `[etCalendar]` element. | Move the cell inside the calendar root. |

## Date & time inputs (ET30xx)

The date input, date range input, [time picker](/components/time-picker), time input, time range input and date-time input share this block (the picker trigger/surface pieces work with any of the input hosts).

| Code     | Cause                                                                          | Fix                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ET3000` | `etDateInputField` is not inside an `[etDateInput]` element.                   | Move the field inside the date input root.                                                                                                             |
| `ET3001` | `etDatePickerTrigger` is not inside a date picker host.                        | Move the trigger inside `[etDateInput]`, `[etDateRangeInput]`, `[etTimeInput]`, `[etDateTimeInput]`, `[etTimeRangeInput]` or `[etDateTimeRangeInput]`. |
| `ET3002` | `etDatePickerSurface` is not inside a date picker host.                        | Move the surface template inside any date picker host.                                                                                                 |
| `ET3003` | The picker was opened without an `etDatePickerSurface` template.               | Add `<ng-template etDatePickerSurface>` inside the host element.                                                                                       |
| `ET3010` | `etDateRangeInputField` is not inside an `[etDateRangeInput]` element.         | Move the field inside the date range input root.                                                                                                       |
| `ET3011` | A date range input has two fields for one side.                                | Keep one `etDateRangeInputField` for each `side`.                                                                                                      |
| `ET3020` | `etTimePickerColumn` is not inside an `[etTimePicker]` element.                | Move the column inside the time picker root.                                                                                                           |
| `ET3021` | `etTimePickerOption` is not inside an `[etTimePickerColumn]` element.          | Move the option inside a column.                                                                                                                       |
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

| Code     | Cause                                                                                              | Fix                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ET1200` | An `[etOverlay]` element has no surface template.                                                  | Add `<ng-template etOverlaySurface>` inside the `[etOverlay]` element.                        |
| `ET1201` | `etOverlayTrigger` is not inside an `[etOverlay]` element.                                         | Move the trigger inside the overlay root.                                                     |
| `ET1202` | `etOverlayAnchor` is not inside an `[etOverlay]` element.                                          | Move the anchor inside the overlay root.                                                      |
| `ET1203` | `etOverlaySurface` is not inside an `[etOverlay]` element.                                         | Move the surface template inside the overlay root.                                            |
| `ET1204` | Merged overlay strategies each contribute a layout class for the same config key.                  | Overwrite the layout class instead of combining strategies that each provide one.             |
| `ET1205` | A closest-overlay lookup ran on an element that isn't rendered inside an open overlay.             | Only call it from content rendered inside an overlay.                                         |
| `ET1206` | An overlay contains nested `<et-overlay-main>` elements or `etOverlayMain` directives.             | Keep exactly one main region per overlay.                                                     |
| `ET1207` | An overlay definition's `injectRef()` was called outside a component opened via that definition.   | Call it only inside the component the definition opens.                                       |
| `ET1208` | An `et-overlay-header`, `et-overlay-body`, or `et-overlay-footer` has no `etOverlayMain` ancestor. | Wrap them in an `<et-overlay-main>` element or a host carrying the `etOverlayMain` directive. |
| `ET1209` | The full-screen enter animation ran without an origin element to grow out of.                      | Pass `origin` in the overlay config (the strategy otherwise uses its reduced animation).      |
| `ET1210` | The `strategies` factory returned an empty array, so the overlay has no strategy to open with.     | Return at least one entry, including one without a `breakpoint` as the base strategy.         |

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

| Code     | Cause                                                                       | Fix                                                                                  |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ET1600` | The configured consent component doesn't provide the stream consent token.  | Add `hostDirectives: [StreamConsentDirective]` to the consent component.             |
| `ET1601` | A platform SDK script failed to load.                                       | Check the URL and network - ad blockers commonly block player SDKs.                  |
| `ET1602` | The Twitch Embed SDK loaded but its global isn't available.                 | Ensure the Twitch Embed SDK URL is accessible and not rewritten.                     |
| `ET1603` | The YouTube IFrame API loaded but `YT.Player` isn't available.              | Ensure the YouTube IFrame API URL is accessible and not rewritten.                   |
| `ET1604` | The configured PiP chrome component doesn't provide the PiP chrome token.   | Implement `PipChromeRef` and provide `PIP_CHROME_REF_TOKEN` with `useExisting`.      |
| `ET1605` | The Facebook SDK loaded but its global isn't available.                     | Ensure the Facebook SDK URL is accessible and not rewritten.                         |
| `ET1606` | The Vimeo Player SDK isn't available, or the player failed to become ready. | Ensure the Vimeo SDK URL is accessible; the message contains the underlying failure. |
| `ET1607` | The TikTok player reported an error.                                        | The message contains the platform's error value; the video may be unavailable.       |
| `ET1608` | A Facebook video didn't become ready in time.                               | The video may be unavailable or restricted.                                          |

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

`ET1802`–`ET1805` are dev-mode-only SVG validations; `ET1800`/`ET1801` also throw in production.

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

| Code     | Cause                                                                                     | Fix                                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ET2000` | A tab trigger has no enclosing tab bar.                                                   | Place it inside `et-tab-group`, `et-nav-tabs`, or an `[etTabBar]` element.   |
| `ET2001` | `<et-tab>` or `etTabPanel` is outside a tab group (an orphan `<et-tab>` renders nothing). | Move it inside `et-tab-group` / an `[etTabGroup]` element.                   |
| `ET2002` | A headless tab group has triggers but no registered `etTabPanel`.                         | Add a panel per tab.                                                         |
| `ET2003` | `a[et-nav-tab-link]` or `et-nav-tabs-outlet` is used without an `et-nav-tabs` element.    | Add the `et-nav-tabs` bar (links go inside it; the outlet can be a sibling). |

## Scrollable (ET21xx)

| Code     | Cause                                                | Fix                                                                   |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `ET2100` | A headless `[etScrollable]` has no scroll container. | Use `<et-scrollable>`; headless `[etScrollable]` does not create one. |

## Form field (ET22xx)

| Code     | Cause                                                                                 | Fix                                                                                                            |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ET2200` | An `<et-form-field>` contains no form control.                                        | Add a control such as `<et-input>` or `<et-checkbox>` inside the field.                                        |
| `ET2201` | An `<et-form-field>` control has no accessible name (no label and no aria attribute). | Project an `<et-label>`, or set `aria-label` / `aria-labelledby` on the control. A placeholder is not a label. |

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

| Code     | Cause                                                                   | Fix                                                                                                                                  |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ET2500` | Two triggers share the same `char`.                                     | Give each trigger a unique trigger character.                                                                                        |
| `ET2501` | Two triggers share the same `type`.                                     | Give each trigger a unique type.                                                                                                     |
| `ET2502` | A trigger `type` is malformed.                                          | Match `[a-z][a-z0-9-]*` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown.                                    |
| `ET2503` | An item `id` is malformed.                                              | Match `[A-Za-z0-9._:-]+` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown.                                   |
| `ET2504` | `etRichTextEditorTriggers` is on an element without `etRichTextEditor`. | Place it on the editor element (e.g. `<et-rich-text-editor>`).                                                                       |
| `ET2505` | `insertToken`/`insertTokenItem` called with no token codec installed.   | Add `etRichTextEditorTriggers` or `provideRichTextEditorTokenRendering(triggers)`.                                                   |
| `ET2506` | A command was called whose tool is not provided (the message names it). | Add the named provider - e.g. `provideRichTextEditorLinkTool()` - or `provideRichTextEditorDefaultTools()` for the full default set. |

## Bracket (ET34xx)

Runtime errors from the bracket data pipeline and layout engine. They indicate a malformed or unsupported `BracketDataSource` rather than a template-placement mistake.

| Code     | Cause                                                                        | Fix                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ET3401` | The source has no rounds/matches to render.                                  | Provide a non-empty `BracketDataSource`.                                                                                            |
| `ET3402` | An integration received an unsupported tournament mode.                      | Use a supported mode (`single-elimination`, `double-elimination`, swiss-with-elimination).                                          |
| `ET3403` | Two rounds in the source share an id.                                        | Give every round a unique `id`.                                                                                                     |
| `ET3404` | Two matches in the source share an id.                                       | Give every match a unique `id`.                                                                                                     |
| `ET3405` | A round-to-round relation couldn't be resolved (malformed round structure).  | Emit the expected round types/counts for the mode (see the Bracket guide).                                                          |
| `ET3406` | A match-to-match relation couldn't be resolved (match counts don't line up). | Ensure each round's match count follows the mode's halving/lower-bracket pattern.                                                   |
| `ET3407` | The computed layout grid ended up in an inconsistent state.                  | Check the round types and match counts against the mode's expected structure.                                                       |
| `ET3408` | Swiss groups couldn't be generated from the source.                          | Ensure per-match win/loss records are consistent across swiss rounds.                                                               |
| `ET3409` | A swiss group ended up empty while round headers are enabled.                | Populate every available win/loss group, or hide round headers.                                                                     |
| `ET3410` | A match's resolved winner id isn't among its participants.                   | Set `winner` to `'home'`/`'away'`/`null` matching the match's `home`/`away`.                                                        |
| `ET3411` | A required key was missing from an internal bracket lookup.                  | Ensure every match `roundId` references an existing round.                                                                          |
| `ET3412` | The default cards are rendering but no `matchNormalizer` was registered.     | Add `provideBracketConfig({ matchNormalizer })` - the Ethlete feed ships `normalizeEthleteBracketMatch` - or supply your own cards. |
| `ET3413` | No registered bracket layout matches the source's tournament `mode`.         | Add the mode's factory (e.g. `doubleEliminationBracketLayout()`) to `provideBracketConfig({ layouts })` or to the `layouts` input.  |

## Table (ET35xx)

| Code     | Cause                                                                              | Fix                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ET3501` | A table feature (e.g. `etTableFilters`) was used outside an `<et-table>`.          | Put the feature attribute on the `<et-table>` element itself.                                                                                                 |
| `ET3502` | Two features tried to window the rows (e.g. two virtual-scroll features).          | Use only one row-windowing feature per table.                                                                                                                 |
| `ET3503` | An `etTableCell` / `etTableHeaderCell` / `etTableFooterCell` sits outside a table. | Move the `<ng-template>` inside the `<et-table>` whose column it renders.                                                                                     |
| `ET3504` | A column template is bound to a column this table doesn't render.                  | Bind it to a column of the same `columns` record, e.g. `[etTableCell]="COLUMNS.role"`.                                                                        |
| `ET3505` | A CSV export named a column key the table doesn't declare.                         | Check the key against the `columns` record, or drop the `columns` option to take the visible ones.                                                            |
| `ET3506` | A CSV export would write fewer rows than the table's source says exist.            | Pass `rows` (a list or a provider such as `tableCsvRowsFromPages`), `file` for a server-built export, or `partial: true` to write the loaded page on purpose. |
| `ET3507` | A CSV export was given `file` together with options for building one.              | The server already wrote that file - drop `rows`/`columns`/`header`/`delimiter`/`formulaGuard`/`bom`, or drop `file`.                                         |
| `ET3508` | An `expandedRowTemplate` is bound, but nothing renders it.                         | Add `etTableRowExpansion` to the table and import `TABLE_ROW_EXPANSION_IMPORTS` - see [Row expansion](/components/table#row-expansion).                       |
| `ET3509` | A `rowLink` answered with router commands, but nothing resolves them.              | Add `etTableRowRouterLink` and import `TABLE_ROW_ROUTER_LINK_IMPORTS`, or answer with an `href` string - see [Row links](/components/table#row-links).        |
| `ET3510` | A `rowsSource` publishes `sort`/`filters` without the setter to write them.        | Add `setSort`/`setFilters`, or drop the signal and let the table own it - see [One binding instead of six](/components/table#one-binding-instead-of-six).     |

`ET3500` is retired: it flagged duplicate column keys, which the keyed
`TableColumns` record makes impossible.

## Accordion (ET36xx)

All accordion checks run in dev mode only, after the first render.

| Code     | Cause                                                                                   | Fix                                                                                             |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ET3600` | An `etAccordionTrigger`, `etAccordionPanel` or slot template sits outside an accordion. | Move it inside the `[etAccordion]` element (e.g. `<et-accordion>`) it belongs to.               |
| `ET3601` | An accordion rendered no `etAccordionTrigger`, so nothing can expand it.                | Add a trigger - ideally a `<button etAccordionTrigger>` inside a heading.                       |
| `ET3602` | An accordion is open but has no `etAccordionPanel`.                                     | Add an `etAccordionPanel` element, or render it conditionally only while the accordion is open. |

## Breadcrumb (ET37xx)

All breadcrumb checks run in dev mode only, after the first render.

| Code     | Cause                                                                               | Fix                                                                         |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ET3700` | An `etBreadcrumbItemTemplate` or `etBreadcrumbSeparator` sits outside a breadcrumb. | Move the `<ng-template>` inside the `[etBreadcrumb]` element it belongs to. |
| `ET3701` | A breadcrumb has no crumb templates, so there is no trail to render.                | Declare one `<ng-template etBreadcrumbItemTemplate>` per crumb.             |

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

Checked in dev mode only, after the first render.

| Code     | Cause                                                     | Fix                                        |
| -------- | --------------------------------------------------------- | ------------------------------------------ |
| `ET4400` | Two `zones` cover the same position, so a row is in both. | Give every zone its own `from`–`to` range. |

## Scheduler (ET45xx)

Checked in dev mode only.

| Code     | Cause                                                                                                           | Fix                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `ET4500` | An opt-in scheduler feature is used outside an `<et-scheduler>`.                                                | Move the feature inside the scheduler root.               |
| `ET4501` | A view layout directive (e.g. `[etSchedulerMonth]`) is placed outside an `[etScheduler]`.                       | Move it inside the scheduler root.                        |
| `ET4502` | An edit-surface feature (an edit field or appointment action) is used outside an `<et-scheduler-edit-surface>`. | Move it inside the edit surface root.                     |
| `ET4503` | `[etSchedulerSwipeNavigation]` is placed on an element that is not an `[etScheduler]`.                          | Move it onto the scheduler root.                          |
| `ET4505` | An appointment was selected or created without a registered default edit surface.                               | Add `provideSchedulerEditSurface()` to a parent injector. |

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
