# Time picker

`et-time-picker` is an inline column-list time picker operating purely on `Date` objects — one scrollable listbox column per time unit, with the column layout (12/24-hour cycle, optional seconds, AM/PM) derived from a date-fns format string. It is a standalone element (usable outside forms) and the surface the [time input](/components/forms#time-input-—-et-time-input)'s picker overlay hosts. Import `TIME_PICKER_IMPORTS`.

```ts
import { TIME_PICKER_IMPORTS } from '@ethlete/components';
```

```html
<et-time-picker [(value)]="time" />
```

## Live demo

<StoryEmbed id="components-time-picker--default" height="360px" />

## Options

On `et-time-picker` (forwarded from the headless `[etTimePicker]` directive):

| Input        | Type                        | Default             | Description                                                                           |
| ------------ | --------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `format`     | `string`                    | `TIME_FORMAT` token | date-fns time format the columns derive from (token default: `HH:mm`).                |
| `locale`     | `Locale \| null` (date-fns) | `DATE_LOCALE` token | Expands localized format tokens (`p`, `pp`) and the AM/PM labels.                     |
| `minuteStep` | `number`                    | `5`                 | Minute column granularity. An off-step selection is kept visible in the column.       |
| `secondStep` | `number`                    | `1`                 | Seconds column granularity (the column only renders when the format carries seconds). |

| Model   | Type           | Description                                                                   |
| ------- | -------------- | ----------------------------------------------------------------------------- |
| `value` | `Date \| null` | The selected time of day, carried on a `Date`. `null` until a part is picked. |

The component also takes `hoursLabel` / `minutesLabel` / `secondsLabel` / `periodLabel` (`string`) for the columns' `aria-label`s.

The format decides the columns, not just their labels: `HH:mm` renders hour + minute columns, `HH:mm:ss` adds seconds, `h:mm a` switches to a 12-hour cycle with an AM/PM column. Localized tokens work too — `p` resolves per locale (12-hour in en-US, 24-hour in de).

While no value is set, the columns anchor their focus and scroll position to "now" (snapped to the steps); the first pick completes that anchor time with the picked part, so a single click on an hour already yields a full time.

## 12-hour cycle

<StoryEmbed id="components-time-picker--twelve-hour" height="360px" />

## Keyboard

Each column is a vertical listbox with a roving tabindex; selection follows focus.

| Key                 | Action                                             |
| ------------------- | -------------------------------------------------- |
| ArrowUp / ArrowDown | Previous / next option (wrapping — time is cyclic) |
| Home / End          | First / last option                                |
| Typing digits       | Jump to the matching option (`2`,`3` → 23)         |

## Headless usage

`[etTimePicker]` owns all state; `[etTimePickerColumn]` (one per unit, fed a `TimePickerColumn` from `picker.columns()`) and `[etTimePickerOption]` (one per option button) render however you like:

```html
<div #picker="etTimePicker" [(value)]="time" etTimePicker>
  @for (column of picker.columns(); track column.unit) {
  <div [column]="column" etTimePickerColumn>
    @for (option of column.options; track option.value) {
    <button [option]="option" etTimePickerOption>{{ option.label }}</button>
    }
  </div>
  }
</div>
```

Each `TimePickerOption` carries `selected` / `focused` flags the option directive mirrors as `data-*` attributes for styling; the column keeps the focused option centered in its scrollport.

## Accessibility

- Each column is a labelled `role="listbox"` (`aria-orientation="vertical"`) whose options carry `aria-selected`; exactly one option per column is tabbable.
- Arrow selection follows focus, so what's announced is always what's selected.
- Disabled/readonly states belong to the hosting control (e.g. the time input) — the inline picker itself is always interactive.

## Theming

Selection colors come from the nearest [color theme](/core/theming) (`--et-theme-color-primary-solid`, `--et-theme-color-on-primary`); text and hover tints use surface tokens. Public design tokens:

| Token                          | Default | Purpose                              |
| ------------------------------ | ------- | ------------------------------------ |
| `--et-time-picker-column-size` | `224px` | Block size of the scrollable columns |
| `--et-time-picker-option-size` | `36px`  | Block size of one option             |

## Error codes

The time picker's structural checks live in the shared date & time block — see [error codes](/components/error-codes#date-time-inputs-et30xx) (`ET3020`/`ET3021`).
