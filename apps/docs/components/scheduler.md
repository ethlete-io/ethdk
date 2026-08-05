# Scheduler

`et-scheduler` is a composable appointment calendar, Google-Calendar-shaped: a month grid, a week/day hour-axis time grid, and an agenda list, all sharing one headless engine. Appointments can nest into arbitrarily deep "sub-appointment" chains (a project's Jira-esque sub-tasks), each with its own start/end. Import `SCHEDULER_IMPORTS`.

```ts
import { SCHEDULER_IMPORTS } from '@ethlete/components';
```

```html
<et-scheduler [(selectedAppointmentId)]="selectedId" [appointments]="appointments" />
```

## Live demo

<StoryEmbed id="components-scheduler--default" height="640px" />

## The appointment model

The scheduler doesn't fetch - a consumer passes a flat list, and nesting is a single `parentId` field rather than a fixed hierarchy:

```ts
type AppointmentId = string;

type Appointment<TExtra = unknown> = {
  id: AppointmentId;
  parentId: AppointmentId | null;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  colorToken?: string;
  extra?: TExtra;
};
```

- `parentId` links an appointment under another, to any depth - a dangling reference (the parent was filtered out) falls back to top-level rather than being dropped.
- `colorToken` resolves through the [color theming](/core/theming) system - it's read as `[etProvideColor]` on the appointment's badge, so pass whatever theme name your app registered (`'brand'`, `'danger'`, …), never a literal color.
- `extra` is the open extension point for a custom edit surface (planned) to read and write, so adding a field never widens `Appointment` itself.
- An appointment renders on **every day it spans**, not just the day it starts - a 3-day `allDay` appointment shows a badge on all three month-view day cells, and one bar spanning all three columns in the time grid's all-day strip.

## Options

On `et-scheduler` (forwarded from the headless `[etScheduler]` directive):

| Input                   | Type                        | Default             | Description                                                                          |
| ----------------------- | --------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `appointments`          | `readonly Appointment[]`    | `[]`                | Every appointment the scheduler knows about - not pre-filtered to the visible range. |
| `view`                  | `SchedulerView`             | `'month'`           | Which view is on screen - `'month' \| 'week' \| 'day' \| 'agenda'`.                  |
| `focusedDate`           | `Date`                      | today               | The date the visible period is derived from.                                         |
| `selectedAppointmentId` | `AppointmentId \| null`     | `null`              | The currently selected appointment.                                                  |
| `locale`                | `Locale \| null` (date-fns) | `DATE_LOCALE` token | Weekday names and the header label. Falls back to date-fns' built-in en-US.          |
| `firstDayOfWeek`        | `0–6`                       | locale, else `1`    | `0` = Sunday. Defaults to the locale's week start, Monday without one.               |

| Model                   | Type                    | Description                                  |
| ----------------------- | ----------------------- | -------------------------------------------- |
| `view`                  | `SchedulerView`         | Which view is on screen.                     |
| `selectedAppointmentId` | `AppointmentId \| null` | The selected appointment's id.               |
| `focusedDate`           | `Date`                  | The date the visible period is derived from. |

The toolbar's Month/Week/Day/Agenda control (an [`et-segmented-button-group`](/components/choice-inputs#selection-lists)) writes straight into `view` - there's no separate switch input to wire up yourself.

## Month view

A day cell per day of the padded month, leading/trailing days from adjacent months included. Each cell shows up to `maxVisiblePerCell` appointments (chain order, depth-first) as one-line badges; the rest collapse into a "+N more" affordance that opens an [`et-menu`](/components/menu) popover listing them.

```html
<et-scheduler-month-view [maxVisiblePerCell]="3" />
```

| Input               | Type     | Default | Description                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `maxVisiblePerCell` | `number` | `3`     | How many appointments a day cell shows before the rest overflow. |

Clicking a badge (in the grid or the overflow popover) sets `selectedAppointmentId`. `<et-scheduler-month-view>` reads its host `[etScheduler]` via DI, so it only renders correctly inside `<et-scheduler>` or your own `[etScheduler]` element.

## Time grid: week & day view

An hour axis with one column per day - a single column for the day view, seven for the week view. Both are the **same** `<et-scheduler-time-grid-view>`; only the visible range differs, driven by `view`. All-day appointments render as one bar spanning the visible days they cover in a strip above the hour grid - a 3-day appointment draws once, not once per day - stacked into rows when two spans overlap; timed appointments are laid out at their actual position and duration.

<StoryEmbed id="components-scheduler--week" height="640px" />

```html
<et-scheduler-time-grid-view />
```

It takes no inputs of its own - like the month view, it reads its host `[etScheduler]` via DI. Appointments that overlap in time are packed into side-by-side columns wide enough to fit the busiest overlap group in view, so nothing ever visually overlaps; appointments that don't overlap anything each get the column's full width. A sub-appointment renders in its own column exactly like any other appointment (its own overlap group can differ from its parent's) but gets a depth-scaled inline inset and a shifted color dot, capped past four levels, as a "belongs to" cue - the day view below shows a two-level chain next to its sibling.

<StoryEmbed id="components-scheduler--day" height="640px" />

Clicking a block (or an all-day entry) sets `selectedAppointmentId`, same as the month view.

## Agenda view

A flat list, grouped by day: each day of the visible range that has at least one appointment gets a section, with its appointments as full-width badges in chain order (depth-first, indented per level). A day with nothing on it is skipped entirely rather than rendering an empty section.

<StoryEmbed id="components-scheduler--agenda" height="640px" />

```html
<et-scheduler-agenda-view />
```

It takes no inputs of its own - like the other views, it reads its host `[etScheduler]` via DI. The agenda shares its visible range with the week view (the same 7-day window), so switching between them keeps the same days on screen. Clicking a badge sets `selectedAppointmentId`, same as the other views.

## Sub-appointment chains

An appointment's `parentId` is the whole nesting model - no `level`, no depth limit. The headless tier builds the tree once (`appointmentTree()`) and every consumer of it - month, time grid, and agenda - walks it depth-first, so a chain renders in the same order everywhere. A chain stays in depth order even when its root falls outside the visible range or day - a child never gets promoted to the top level just because its parent isn't shown. The month view carries a child's `depth` on its badge for a future indent/collapse affordance; the time grid uses it for the inline inset described above, and the agenda view for its indentation.

## Headless usage {#headless-usage}

`[etScheduler]` owns all state - the active view, the focused date, the derived visible range, and the appointment tree. `[etSchedulerMonth]` buckets that into a month grid and is itself what `<et-scheduler-month-view>` hosts; `[etSchedulerTimeGrid]` does the same for the time grid, exposing `days()` - one entry per visible day, each with its packed `blocks` (`offset`/`span`/`inlineOffset`/`inlineSize` as percentages, `column`/`columnCount` for the overlap group it landed in) - and `allDay()`, the all-day entries spanning across those days (`inlineOffset`/`inlineSize` as percentages of the whole visible range, `row` for the stacking row an overlapping span landed in; `allDayRowCount()` is how many rows that needs):

```html
<div #scheduler="etScheduler" [appointments]="appointments" etScheduler>
  <div #month="etSchedulerMonth" etSchedulerMonth>
    @for (week of month.weeks(); track $index) {
    <div>
      @for (cell of week; track cell.date.getTime()) {
      <span>{{ cell.date.getDate() }} - {{ cell.visible.length }} shown, {{ cell.overflow.length }} more</span>
      }
    </div>
    }
  </div>
</div>
```

`scheduler.visibleRange()` is the active view's date span (month pads to full weeks); `scheduler.visibleAppointments()` narrows `appointments()` to ones overlapping it at all, before any per-view bucketing. `scheduler.next()` / `previous()` / `goToToday()` step `focusedDate` by the active view's unit - a day, a week, or a month.

### Feature host

`SCHEDULER_FEATURE_HOST` (injected via `injectSchedulerFeatureHost()`) is the read-only surface an opt-in scheduler feature reaches on its host `<et-scheduler>`: `appointments()` (visible-range-filtered), `appointmentTree()`, `selectedAppointment()`, and the scheduler's own `element`. It's modeled on the [table](/components/table)'s feature host, and grows registration points (badge adornments, edit-surface fields) as those features land - there are none yet.

## Accessibility

- Weekday/day headers are `columnheader`s named by the full weekday (`aria-label` in the month view); day cells are `gridcell`s in both grid views. The agenda view is a flat list, not a grid, so its day headers carry no grid role.
- Every appointment badge/block and the "+N more" trigger are real `<button>`s, reachable by Tab; the overflow popover is an `et-menu` and inherits its full [keyboard model](/components/menu#accessibility).
- Neither grid implements the ARIA grid roving-tabindex pattern the [calendar](/components/calendar#accessibility) uses yet - each badge/block is independently tabbable, same as the agenda's badges.
- The Month/Week/Day/Agenda toolbar control is a real [`et-segmented-button-group`](/components/choice-inputs#selection-lists): a `radiogroup` of `radio`s, arrow-key navigable, with a projected (visually hidden) `<et-label>` supplying its accessible name.

## Theming

Badge and selection colors come from the nearest [color theme](/core/theming) via each appointment's `colorToken`; chrome (header, weekday labels, cell/hour borders) uses surface tokens. Public design tokens:

| Token                                       | Default | Purpose                                              |
| ------------------------------------------- | ------- | ---------------------------------------------------- |
| `--et-scheduler-month-view-cell-min-size`   | `96px`  | Minimum block size of one month-view day cell.       |
| `--et-scheduler-time-grid-hour-size`        | `48px`  | Block size of one hour row in the time grid.         |
| `--et-scheduler-time-grid-gutter-size`      | `56px`  | Inline size of the time grid's hour-label gutter.    |
| `--et-scheduler-time-grid-all-day-row-size` | `24px`  | Block size of one stacking row in the all-day strip. |

## Error codes

The scheduler domain owns the `ET4500`–`ET4599` range - see [error codes](/components/error-codes#scheduler-et45xx).
