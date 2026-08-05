# Scheduler

`et-scheduler` is a composable appointment calendar - a Google-Calendar-shaped month grid today, with week/day and agenda views planned. Appointments can nest into arbitrarily deep "sub-appointment" chains (a project's Jira-esque sub-tasks), each with its own start/end. Import `SCHEDULER_IMPORTS`.

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
- An appointment renders on **every day it spans**, not just the day it starts - a 3-day `allDay` appointment shows a badge on all three day cells.

## Options

On `et-scheduler` (forwarded from the headless `[etScheduler]` directive):

| Input                   | Type                        | Default             | Description                                                                          |
| ----------------------- | --------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `appointments`          | `readonly Appointment[]`    | `[]`                | Every appointment the scheduler knows about - not pre-filtered to the visible range. |
| `focusedDate`           | `Date`                      | today               | The date the visible month is derived from.                                          |
| `selectedAppointmentId` | `AppointmentId \| null`     | `null`              | The currently selected appointment.                                                  |
| `locale`                | `Locale \| null` (date-fns) | `DATE_LOCALE` token | Weekday names and the header label. Falls back to date-fns' built-in en-US.          |
| `firstDayOfWeek`        | `0–6`                       | locale, else `1`    | `0` = Sunday. Defaults to the locale's week start, Monday without one.               |

| Model                   | Type                    | Description                                 |
| ----------------------- | ----------------------- | ------------------------------------------- |
| `selectedAppointmentId` | `AppointmentId \| null` | The selected appointment's id.              |
| `focusedDate`           | `Date`                  | The date the visible month is derived from. |

`view` isn't forwarded yet - `<et-scheduler>` only ever renders the month grid today, so exposing a switch with no effect would mislead. The headless `[etScheduler]` already models `'month' | 'week' | 'day' | 'agenda'` for the views to come; see [headless usage](#headless-usage).

## Month view

The default (and, for now, only) view: a day cell per day of the padded month, leading/trailing days from adjacent months included. Each cell shows up to `maxVisiblePerCell` appointments (chain order, depth-first) as one-line badges; the rest collapse into a "+N more" affordance that opens an [`et-menu`](/components/menu) popover listing them.

```html
<et-scheduler-month-view [maxVisiblePerCell]="3" />
```

| Input               | Type     | Default | Description                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `maxVisiblePerCell` | `number` | `3`     | How many appointments a day cell shows before the rest overflow. |

Clicking a badge (in the grid or the overflow popover) sets `selectedAppointmentId`. `<et-scheduler-month-view>` reads its host `[etScheduler]` via DI, so it only renders correctly inside `<et-scheduler>` or your own `[etScheduler]` element.

## Sub-appointment chains

An appointment's `parentId` is the whole nesting model - no `level`, no depth limit. The headless tier builds the tree once (`appointmentTree()`) and every consumer of it - the month view today, the planned week/day grid and agenda - walks it depth-first, so a chain renders in the same order everywhere. In the month view a child's badge carries its own `depth` (via the tree node), for a future indent or collapse affordance; today it renders like any other appointment on the day it falls on.

## Headless usage {#headless-usage}

`[etScheduler]` owns all state - the active view, the focused date, the derived visible range, and the appointment tree. `[etSchedulerMonth]` buckets that into a month grid and is itself what `<et-scheduler-month-view>` hosts:

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

- Weekday headers are `columnheader`s named by the full weekday (`aria-label`); day cells are `gridcell`s.
- Every appointment badge and the "+N more" trigger are real `<button>`s, reachable by Tab; the overflow popover is an `et-menu` and inherits its full [keyboard model](/components/menu#accessibility).
- The month grid doesn't yet implement the ARIA grid roving-tabindex pattern the [calendar](/components/calendar#accessibility) uses - each badge is independently tabbable. This is expected to tighten once the week/day grid (phase 2) settles the shared keyboard model across views.

## Theming

Badge and selection colors come from the nearest [color theme](/core/theming) via each appointment's `colorToken`; chrome (header, weekday labels, cell borders) uses surface tokens. Public design token:

| Token                                     | Default | Purpose                                        |
| ----------------------------------------- | ------- | ---------------------------------------------- |
| `--et-scheduler-month-view-cell-min-size` | `96px`  | Minimum block size of one month-view day cell. |

## Error codes

The scheduler domain owns the `ET4500`–`ET4599` range - see [error codes](/components/error-codes#scheduler-et45xx).
