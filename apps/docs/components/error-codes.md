# Error codes

Every error the library throws is a [`RuntimeError` from `@ethlete/core`](/core/utilities#runtime-errors). Its message starts with a stable code — `ET1301: [MenuTriggerDirective] etMenuTrigger must be placed inside an [etMenu] element.` — so you can search this page for the code you see in the console.

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

Some errors carry extra context (the offending config, element, …). That payload isn't serialized into the message — it's logged as a separate `console.error` right after the throw.

Two kinds of checks produce these errors:

- **Structural checks** (a directive placed outside its required parent, a missing required template) run **in dev mode only**, after the first render. Production builds skip them, so fix them during development — the broken structure will silently misbehave in production.
- **Runtime failures** (an icon name that isn't registered, a player SDK that fails to load) throw in production too.

Each domain owns a 100-code block. The codes are exported per domain (e.g. `MENU_ERROR_CODES`, `OVERLAY_ERROR_CODES`) if you need to match on them programmatically.

| Range     | Domain             | Guide                                            |
| --------- | ------------------ | ------------------------------------------------ |
| 1000–1099 | Select             | [Select](/components/select)                     |
| 1100–1199 | Chip               | [Chip](/components/chip)                         |
| 1200–1299 | Overlay            | [Overlays](/components/overlays)                 |
| 1300–1399 | Menu               | [Menu](/components/menu)                         |
| 1400–1499 | Tooltip            | [Tooltip](/components/tooltip)                   |
| 1500–1599 | Toggletip          | [Toggletip](/components/toggletip)               |
| 1600–1699 | Stream             | [Stream](/components/stream)                     |
| 1700–1799 | Notification       | [Notification](/components/notification)         |
| 1800–1899 | Icon               | [Icon](/components/icon)                         |
| 1900–1999 | Grid               | [Grid](/components/grid)                         |
| 2000–2099 | Tabs               | [Tabs](/components/tabs)                         |
| 2100–2199 | Scrollable         | [Scrollable](/components/scrollable)             |
| 2200–2299 | Form field         | [Forms](/components/forms)                       |
| 2300–2399 | Split button       | [Button](/components/button)                     |
| 2400–2499 | Dropzone           | [Dropzone](/components/dropzone)                 |
| 2500–2599 | Rich text editor   | [Rich text editor](/components/rich-text-editor) |
| 2700–2799 | Tag input          | [Forms](/components/forms)                       |
| 2800–2899 | Phone input        | [Forms](/components/forms)                       |
| 2900–2999 | Calendar           | [Calendar](/components/calendar)                 |
| 3000–3099 | Date & time inputs | [Forms](/components/forms)                       |
| 3100–3199 | Slider             | [Slider](/components/slider)                     |
| 3200–3299 | Masked input       | [Forms](/components/forms)                       |
| 3300–3399 | Cascader           | [Cascader](/components/cascader)                 |

::: info Codes below 1000
Codes `0`–`1001` also appear in `@ethlete/query` (query features, auth, web sockets). `ET1000`/`ET1001` therefore exist in both packages — the bracketed source in the message (`[SelectDirective]` vs. a query feature) tells them apart.
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

The date input, date range input, [time picker](/components/time-picker), time input and date-time input share this block (the picker trigger/surface pieces work with any of the input hosts).

| Code     | Cause                                                                  | Fix                                                                                                     |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ET3000` | `etDateInputField` is not inside an `[etDateInput]` element.           | Move the field inside the date input root.                                                              |
| `ET3001` | `etDatePickerTrigger` is not inside a date picker host.                | Move the trigger inside `[etDateInput]` / `[etDateRangeInput]` / `[etTimeInput]` / `[etDateTimeInput]`. |
| `ET3002` | `etDatePickerSurface` is not inside a date picker host.                | Move the surface template inside the host element.                                                      |
| `ET3003` | The picker was opened without an `etDatePickerSurface` template.       | Add `<ng-template etDatePickerSurface>` inside the host element.                                        |
| `ET3010` | `etDateRangeInputField` is not inside an `[etDateRangeInput]` element. | Move the field inside the date range input root.                                                        |
| `ET3020` | `etTimePickerColumn` is not inside an `[etTimePicker]` element.        | Move the column inside the time picker root.                                                            |
| `ET3021` | `etTimePickerOption` is not inside an `[etTimePickerColumn]` element.  | Move the option inside a column.                                                                        |
| `ET3030` | `etTimeInputField` is not inside an `[etTimeInput]` element.           | Move the field inside the time input root.                                                              |
| `ET3040` | `etDateTimeInputField` is not inside an `[etDateTimeInput]` element.   | Move the field inside the date-time input root.                                                         |
| `ET3050` | `etDurationInputField` is not inside an `[etDurationInput]` element.   | Move the field inside the duration input root.                                                          |

## Slider (ET31xx)

| Code     | Cause                                                                                                        | Fix                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `ET3100` | `etSliderThumb` is not inside an `[etSlider]` / `[etRangeSlider]` element.                                   | Move the thumb inside the slider root.                                             |
| `ET3101` | `etSliderTrack` is not inside an `[etSlider]` / `[etRangeSlider]` element.                                   | Move the track inside the slider root.                                             |
| `ET3102` | `ng-template[etSliderThumbLabel]` is not inside an `[etSlider]` / `[etRangeSlider]` element.                 | Move the label template inside the slider root.                                    |
| `ET3103` | The slider has the wrong number of thumbs (`[etSlider]` expects exactly one, `[etRangeSlider]` exactly two). | Add/remove `etSliderThumb` elements, or switch between `etSlider`/`etRangeSlider`. |

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

| Code     | Cause                                                                                            | Fix                                                                               |
| -------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `ET1200` | An `[etOverlay]` element has no surface template.                                                | Add `<ng-template etOverlaySurface>` inside the `[etOverlay]` element.            |
| `ET1201` | `etOverlayTrigger` is not inside an `[etOverlay]` element.                                       | Move the trigger inside the overlay root.                                         |
| `ET1202` | `etOverlayAnchor` is not inside an `[etOverlay]` element.                                        | Move the anchor inside the overlay root.                                          |
| `ET1203` | `etOverlaySurface` is not inside an `[etOverlay]` element.                                       | Move the surface template inside the overlay root.                                |
| `ET1204` | Merged overlay strategies each contribute a layout class for the same config key.                | Overwrite the layout class instead of combining strategies that each provide one. |
| `ET1205` | A closest-overlay lookup ran on an element that isn't rendered inside an open overlay.           | Only call it from content rendered inside an overlay.                             |
| `ET1206` | An overlay contains nested `<et-overlay-main>` elements or `etOverlayMain` directives.           | Keep exactly one main region per overlay.                                         |
| `ET1207` | An overlay definition's `injectRef()` was called outside a component opened via that definition. | Call it only inside the component the definition opens.                           |

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
| `ET1307` | `etMenuContextTrigger` is placed on a submenu.                                                                                 | Context triggers can only open root menus — move it to the outermost `[etMenu]` element.                   |
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
| `ET1601` | A platform SDK script failed to load.                                       | Check the URL and network — ad blockers commonly block player SDKs.                  |
| `ET1602` | The Twitch Embed SDK loaded but its global isn't available.                 | Ensure the Twitch Embed SDK URL is accessible and not rewritten.                     |
| `ET1603` | The YouTube IFrame API loaded but `YT.Player` isn't available.              | Ensure the YouTube IFrame API URL is accessible and not rewritten.                   |
| `ET1604` | The configured PiP chrome component doesn't provide the PiP chrome token.   | Add `hostDirectives: [StreamPipChromeComponent]` to the chrome component.            |
| `ET1605` | The Facebook SDK loaded but its global isn't available.                     | Ensure the Facebook SDK URL is accessible and not rewritten.                         |
| `ET1606` | The Vimeo Player SDK isn't available, or the player failed to become ready. | Ensure the Vimeo SDK URL is accessible; the message contains the underlying failure. |
| `ET1607` | The TikTok player reported an error.                                        | The message contains the platform's error value; the video may be unavailable.       |
| `ET1608` | A Facebook video didn't become ready in time.                               | The video may be unavailable or restricted.                                          |

## Notification (ET17xx)

| Code     | Cause                                                                | Fix                                              |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `ET1700` | `etNotificationAction` is not inside an `[etNotification]` element.  | Move the action inside the notification.         |
| `ET1701` | `etNotificationDismiss` is not inside an `[etNotification]` element. | Move the dismiss button inside the notification. |

## Icon (ET18xx)

| Code     | Cause                                                                   | Fix                                                                                           |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ET1800` | `[etIcon]` is used but no icons are registered.                         | Register icons via `provideIcons()` in component or application providers.                    |
| `ET1801` | The requested icon name (or name/variant combination) isn't registered. | The message lists all available icons — register the missing one or fix the name.             |
| `ET1802` | The registered icon data contains no `<svg>` element.                   | Provide valid SVG markup.                                                                     |
| `ET1803` | The icon's `<svg>` is missing `xmlns="http://www.w3.org/2000/svg"`.     | Add the attribute — it's required for `innerHTML`-based rendering.                            |
| `ET1804` | The icon's `<svg>` is missing `width="100%"` and/or `height="100%"`.    | Add both attributes so the icon scales with its host.                                         |
| `ET1805` | The icon uses a hardcoded `fill`/`stroke` color.                        | Use `currentColor` so the icon follows the text color, or set `[allowHardcodedColor]="true"`. |
| `ET1806` | Two icons were registered with the same name/variant combination.       | Make every name/variant combination unique.                                                   |

`ET1802`–`ET1805` are dev-mode-only SVG validations; `ET1800`/`ET1801` also throw in production.

## Grid (ET19xx)

All grid checks run in dev mode only.

| Code     | Cause                                                                           | Fix                                                                                  |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ET1900` | `etGridItem` is not inside an `[etGrid]` element.                               | Render items inside the grid (e.g. `et-grid`).                                       |
| `ET1901` | `etGridDrag` / `etGridResize` is used outside an `[etGridItem]` element.        | Place the handle on or inside a grid item.                                           |
| `ET1902` | Two grid item configs share the same `id`.                                      | Make item ids unique; the offending configs are logged alongside the error.          |
| `ET1903` | `restoreState()` received a state with breakpoint names that aren't configured. | Align the serialized state's breakpoints with the grid's `breakpoints` input.        |
| `ET1904` | An item's `type` has no registration (such items render nothing).               | Register the type via `provideGridConfig()`; the message lists the registered types. |

## Tabs (ET20xx)

All tabs checks run in dev mode only.

| Code     | Cause                                                                                     | Fix                                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ET2000` | A tab trigger has no enclosing tab bar.                                                   | Place it inside `et-tab-group`, `et-nav-tabs`, or an `[etTabBar]` element.   |
| `ET2001` | `<et-tab>` or `etTabPanel` is outside a tab group (an orphan `<et-tab>` renders nothing). | Move it inside `et-tab-group` / an `[etTabGroup]` element.                   |
| `ET2002` | A headless tab group has triggers but no registered `etTabPanel`.                         | Add a panel per tab.                                                         |
| `ET2003` | `a[et-nav-tab-link]` or `et-nav-tabs-outlet` is used without an `et-nav-tabs` element.    | Add the `et-nav-tabs` bar (links go inside it; the outlet can be a sibling). |

## Scrollable (ET21xx)

| Code     | Cause                                                 | Fix                                                                                                   |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ET2100` | An `etScrollable` has no registered scroll container. | Use the default `<et-scrollable>` component, or register a container via `registerScrollContainer()`. |

## Form field (ET22xx)

| Code     | Cause                                          | Fix                                                                     |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `ET2200` | An `<et-form-field>` contains no form control. | Add a control such as `<et-input>` or `<et-checkbox>` inside the field. |

## Split button (ET23xx)

All split button checks run in dev mode only.

| Code     | Cause                                                              | Fix                                                           |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `ET2300` | An `[etSplitButton]` element has no action segment.                | Add a button with the `etSplitButtonAction` directive.        |
| `ET2301` | An `[etSplitButton]` element has no trigger segment.               | Add a button with the `etSplitButtonTrigger` directive.       |
| `ET2302` | `etSplitButtonAction` is not inside an `[etSplitButton]` element.  | Move the action inside the split button (`et-split-button`).  |
| `ET2303` | `etSplitButtonTrigger` is not inside an `[etSplitButton]` element. | Move the trigger inside the split button (`et-split-button`). |

## Dropzone (ET24xx)

All dropzone checks run in dev mode only.

| Code     | Cause                                                                                | Fix                                                                                  |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `ET2400` | The `upload` input is not a valid config (missing `queryCreator` or `selectValue`).  | Create the config via `createDropzoneUpload({ queryCreator, selectValue, ... })`.    |
| `ET2401` | The control was initialized with a value but the config has no `resolveExisting`.    | Add a `resolveExisting` function so existing values can be displayed.                |
| `ET2402` | The control value shape doesn't match the mode (array in single mode or vice versa). | Set `multiple` to match the value shape, or write a value matching the current mode. |

## Rich text editor (ET25xx)

All rich text editor checks run in dev mode only, and cover the opt-in `etRichTextEditorTriggers` building blocks.

| Code     | Cause                                                                   | Fix                                                                                                |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ET2500` | Two triggers share the same `char`.                                     | Give each trigger a unique trigger character.                                                      |
| `ET2501` | Two triggers share the same `type`.                                     | Give each trigger a unique type.                                                                   |
| `ET2502` | A trigger `type` is malformed.                                          | Match `[a-z][a-z0-9-]*` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown.  |
| `ET2503` | An item `id` is malformed.                                              | Match `[A-Za-z0-9._:-]+` so the <code v-pre>{{type:id}}</code> token round-trips through Markdown. |
| `ET2504` | `etRichTextEditorTriggers` is on an element without `etRichTextEditor`. | Place it on the editor element (e.g. `<et-rich-text-editor>`).                                     |
