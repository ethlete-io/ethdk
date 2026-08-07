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
  location?: string;
  description?: string;
  extra?: TExtra;
};
```

- `parentId` links an appointment under another, to any depth - a dangling reference (the parent was filtered out) falls back to top-level rather than being dropped.
- `colorToken` resolves through the [color theming](/core/theming) system - it's read as `[etProvideColor]` on the appointment's badge, so pass whatever theme name your app registered (`'brand'`, `'danger'`, …), never a literal color.
- `location` shows in the badge via the built-in `etSchedulerBadgeLocation` adornment when set - see [badge composability](#badge-composability).
- `description` is edited by the built-in `etSchedulerEditDescription` field - see [edit surface](#edit-surface).
- `extra` is the open extension point for a custom edit field to read and write, so adding one never widens `Appointment` itself.
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

| Output               | Payload                    | Fires when                                                                                                      |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `appointmentSave`    | `Appointment`              | The default [edit surface](#edit-surface) saves an edit, a new sub-appointment, or a new top-level appointment. |
| `appointmentsDelete` | `readonly AppointmentId[]` | The edit surface's "Delete (with descendants)" action removes an appointment and its chain.                     |

The toolbar's Month/Week/Day/Agenda control (an [`et-segmented-button-group`](/components/choice-inputs#selection-lists)) writes straight into `view` - there's no separate switch input to wire up yourself. `appointments` is one-way: the scheduler never mutates it, so applying `appointmentSave`/`appointmentsDelete` back onto your own signal is on you - see the [edit surface](#edit-surface) section.

## Toolbar

Today, prev/next, the period label, and the view switch, all in `<et-scheduler>`'s own header. Below a ~480px container width (a CSS container query on the scheduler itself, not a page-level media query, so it responds to how much room `<et-scheduler>` actually has) the view switch drops onto its own row below the nav controls; the period label always truncates with an ellipsis rather than pushing other controls off-screen.

Toolbar actions are the same self-registering-feature mechanism as everything else - `registerToolbarAction({ label, icon?, run, order, enabled })` on [`SCHEDULER_FEATURE_HOST`](#feature-host). One is built in:

| Directive                         | Does                                                                                                                                                                      | Default order |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `etSchedulerActionAddAppointment` | Opens the [edit surface](#edit-surface) for a brand-new, blank, top-level appointment - anchored to `focusedDate`, defaulting to the next hour if that's today, else 9am. | `0`           |

```html
<et-scheduler [etSchedulerActionAddAppointment]="{ enabled: false }" [appointments]="appointments" />
```

Like the edit surface's own "Add sub-appointment"/"Delete" actions, this depends on the default edit surface (it's what the dialog it opens is) - a bare `[etScheduler]` composition needs its own "new appointment" affordance, the same caveat [clicking a badge](#month-view) already has.

### At narrow widths {#toolbar-narrow}

At the same ~480px the view switch reflows at, two more things change - both driven by the scheduler's own width, so a scheduler in a narrow sidebar gets them on a desktop viewport too:

- **Today drops its text** and becomes a round icon button matching the prev/next buttons beside it. It carries the same `aria-label` in both shapes, so its accessible name never changes.
- **Toolbar actions become FABs**, wrapped in a [floating action](/components/floating-action): they sit in the header where they were written, and pin themselves to the bottom-inline-end corner of the viewport once the header has scrolled away. An action with an `icon` renders icon-only (named by its `label`); one without renders as an extended FAB with its label.

<StoryEmbed id="components-scheduler--narrow" height="640px" />

## Swipe navigation {#swipe-navigation}

`etSchedulerSwipeNavigation` steps the visible period with a horizontal swipe: toward the inline start for the next period, toward the inline end for the previous one - the same steps prev/next take, so what a swipe moves by depends on the active view. It's bundled by `<et-scheduler>`; add it to a bare `[etScheduler]` composition to get the same gesture, and turn it off with `{ enabled: false }`.

```html
<et-scheduler [etSchedulerSwipeNavigation]="{ enabled: false }" [appointments]="appointments" />
```

**Touch only.** A horizontal drag with a mouse is [drawing a range](#drag-to-create), not navigating. A swipe has to travel ~56px, or ~32px thrown fast enough to read as a flick; anything shorter, and anything the tracker sees as vertical, is left to the view to scroll. Once a swipe passes ~16px the scheduler takes the gesture over, which also swallows the tap the browser would otherwise synthesize on release - so swiping across an appointment navigates instead of opening it, while tapping one still opens it. A [drag-to-create](#drag-to-create) long press that has already armed keeps the gesture; the swipe drops out rather than doing both.

## Month view

A day cell per day of the padded month, leading/trailing days from adjacent months included. Each cell shows up to `maxVisiblePerCell` appointments (chain order, depth-first) as one-line badges; the rest collapse into a "+N more" affordance that opens an [`et-menu`](/components/menu) popover listing them.

```html
<et-scheduler-month-view [maxVisiblePerCell]="3" />
```

| Input               | Type     | Default | Description                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `maxVisiblePerCell` | `number` | `3`     | How many appointments a day cell shows before the rest overflow. |

Clicking a badge (in the grid or the overflow popover) sets `selectedAppointmentId`, which `<et-scheduler>` reacts to by opening the [edit surface](#edit-surface) - see that section for what a bare `[etScheduler]` composition needs to do instead. `<et-scheduler-month-view>` reads its host `[etScheduler]` via DI, so it only renders correctly inside `<et-scheduler>` or your own `[etScheduler]` element.

## Time grid: week & day view

An hour axis with one column per day - a single column for the day view, seven for the week view. Both are the **same** `<et-scheduler-time-grid-view>`; only the visible range differs, driven by `view`. All-day appointments render as one bar spanning the visible days they cover in a strip above the hour grid - a 3-day appointment draws once, not once per day - stacked into rows when two spans overlap; timed appointments are laid out at their actual position and duration.

The 24-hour body is bounded and internally scrollable (`--et-scheduler-time-grid-body-max-height`, default `600px`) rather than growing the page - the day header and all-day strip above it always stay in view. On mount it scrolls itself to a relevant hour: the current time (with an hour of lead-in) when today is one of the visible days, else the earliest appointment's hour, else 9am - so opening day/week view never starts on an empty screen scrolled to midnight. It scrolls once, on mount, not on every `focusedDate` change - stepping to the next day/week never yanks your own scroll position back.

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

## Drag to create {#drag-to-create}

Dragging across empty space on the **week**, **day** or **month** view draws a new appointment and opens the [edit surface](#edit-surface) over it on release, prefilled with what you drew. The agenda is a list with no geometry to drag across, so it has none.

- **Week and day** draw a time range down a day column. It snaps to 15-minute slots and is never shorter than one.
- **Month** draws an all-day span across day cells, in either direction.

A press that never passes the drag threshold stays a plain click, so clicking empty space does nothing, and a press that starts **on** an appointment (or a "+N more" trigger) does not draw over it.

**On touch it starts with a long press.** Both views scroll, so a finger that simply drags is panning - the browser claims the gesture and cancels it. Holding still for ~400ms arms the range instead, and from that point scrolling is blocked until you let go, so the drag draws. Releasing a long press without moving still creates the first slot or day. A quick swipe scrolls exactly as before, and a tap still does nothing.

The range stays visible while the surface is open and disappears when it closes - dismiss without saving and nothing is created. A gesture the browser takes away (a `pointercancel`) clears it without opening anything.

The state behind it lives on the headless directive, so a custom view can drive the same flow: `draftRange` (the live range, whether it is `dragging` or `committed`, and `allDay` for day-granular views), written with `beginDraftRange()` / `extendDraftRange()` for a time axis or `setDraftRange()` for whole days, settled with `commitDraftRange()` and dropped with `clearDraftRange()`.

## Edit surface {#edit-surface}

Clicking any appointment badge or block opens `<et-scheduler-edit-surface>`, built on the [overlay](/components/overlays) system, which `<et-scheduler>` opens automatically whenever `selectedAppointmentId` becomes non-`null` and closes back to `null` when it does. This is the zero-config path: a plain `<et-scheduler>` with no feature directives applied already gets a full edit experience.

Where it opens depends on whether there is something on the calendar to open it over:

| Opened by                                     | Below `md`  | `md` and up                            |
| --------------------------------------------- | ----------- | -------------------------------------- |
| Clicking an appointment                       | Full screen | Anchored to that appointment           |
| [Dragging a range](#drag-to-create) on a view | Full screen | Anchored to the range you drew         |
| The toolbar's add-appointment action          | Full screen | Centered dialog - nothing to anchor to |

A phone gets the whole viewport in every case, where the form needs the space. Selecting an appointment that is not on screen - writing `selectedAppointmentId` yourself, or picking one from a month cell's overflow menu - has no element to anchor to either, so it falls back to a centered dialog.

```html
<et-scheduler
  [appointments]="appointments"
  (appointmentSave)="onSave($event)"
  (appointmentsDelete)="onDelete($event)"
/>
```

The scheduler never mutates `appointments` itself - `appointmentSave` emits the edited (or newly-added) `Appointment` for you to merge back into your own array, and `appointmentsDelete` emits every id to remove (the appointment plus, for "Delete (with descendants)", its whole sub-appointment chain) for you to filter out. See the [live demo](#live-demo)'s story source for the merge/filter logic.

Like the badge, the surface is built from self-registering feature directives bundled onto `<et-scheduler-edit-surface>` by default - not a set of boolean inputs. Disable one by binding its own config input:

```html
<et-scheduler-edit-surface [etSchedulerEditDescription]="{ enabled: false }" />
```

### Fields

| Directive                    | Edits         | Control                                                   | Default order |
| ---------------------------- | ------------- | --------------------------------------------------------- | ------------- |
| `etSchedulerEditTitle`       | `title`       | [`et-input`](/components/text-inputs#text-field)          | `0`           |
| `etSchedulerEditTimeRange`   | `start`/`end` | Two [`et-date-time-input`](/components/date-time-inputs)s | `10`          |
| `etSchedulerEditLocation`    | `location`    | `et-input`                                                | `20`          |
| `etSchedulerEditDescription` | `description` | [`et-textarea`](/components/text-inputs#textarea)         | `30`          |
| `etSchedulerEditColor`       | `colorToken`  | `et-input` (plain text - see below)                       | `40`          |

The title field is required - the Save button disables while it's blank. The time-range field is invalid while `end` is before `start`. Both gate the surface's save button; a custom field can do the same by including a `valid: Signal<boolean>` in its registration.

The color field is a plain text box for `colorToken`, not a swatch picker: theme names are [app-registered](/core/theming), so the SDK has no fixed palette to offer as choices. An app that wants a swatch picker can write its own `etSchedulerEditColor` replacement against a known list of its own theme names.

Add your own field the same way: a directive that injects `SCHEDULER_EDIT_SURFACE_HOST` (via `injectSchedulerEditSurfaceHost()`) and calls `registerEditField({ component, order, enabled, valid })` from its constructor. `component` must declare a `draft: InputSignal<WritableSignal<Appointment>>` input - call `draft()` for the shared writable signal, then read (`draft()()`) or write (`draft().update(a => ({ ...a, ... }))`) the appointment being edited. Custom fields typically write into `extra`.

### Actions

The header's "⋮" menu lists registered appointment actions - also self-registering directives, bundled by default:

| Directive                            | Does                                                                                                                | Default order |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- |
| `etSchedulerActionAddSubAppointment` | Navigates the surface (in place, no new dialog) to a blank child of the current appointment, `parentId` pre-filled. | `0`           |
| `etSchedulerActionDelete`            | Emits `appointmentsDelete` for the current appointment and every descendant, then closes.                           | `100`         |

Add your own with `registerAppointmentAction({ label, icon?, run, order, enabled, destructive? })` - `destructive: true` renders it with the [error theme](/core/theming) (`et-menu-item`'s destructive variant).

### Navigation: breadcrumb and children

The surface shows an ancestor breadcrumb (when the current appointment has a parent) and a children list (when it has any) - clicking either **navigates the same dialog instance** to that appointment rather than opening a new one. Navigating discards any unsaved edits to the appointment navigated away from, the same "edit a copy" tradeoff the [filter overlay](/components/filter-overlay) makes: the draft resets from the newly-shown appointment's real data every time.

### Edit-surface feature host

`SCHEDULER_EDIT_SURFACE_HOST` (injected via `injectSchedulerEditSurfaceHost()`) is the surface-scoped counterpart to the scheduler's own feature host: `appointment()` (the pre-edit snapshot of whichever appointment is currently shown), `appointmentTree()` (every appointment, for breadcrumb/children/descendant lookups), the surface's own `element`, and `registerEditField()` / `editFields()` plus `registerAppointmentAction()` / `appointmentActions()`. It's separate from `SCHEDULER_FEATURE_HOST` because the two hosts expose genuinely different data - one appointment being edited versus every visible one.

## Sub-appointment chains

An appointment's `parentId` is the whole nesting model - no `level`, no depth limit. The headless tier builds the tree once (`appointmentTree()`) and every consumer of it - month, time grid, and agenda - walks it depth-first, so a chain renders in the same order everywhere. A chain stays in depth order even when its root falls outside the visible range or day - a child never gets promoted to the top level just because its parent isn't shown. The month view carries a child's `depth` on its badge for a future indent/collapse affordance; the time grid uses it for the inline inset described above, and the agenda view for its indentation.

## Badge composability {#badge-composability}

Every appointment badge/block, in every view, is built from the same five pieces, each a self-registering feature directive - not a `showLocation: boolean` input on `<et-scheduler>`. `<et-scheduler>` bundles all five by default, so a zero-config scheduler already renders the full badge; disable one by binding its own config input on `<et-scheduler>` itself:

```html
<et-scheduler [etSchedulerBadgeLocation]="{ enabled: false }" [appointments]="appointments" />
```

| Directive                    | Renders                                                            | Default order |
| ---------------------------- | ------------------------------------------------------------------ | ------------- |
| `etSchedulerBadgeColorDot`   | The small dot in the appointment's own color.                      | `-10`         |
| `etSchedulerBadgeTitle`      | The appointment's title.                                           | `0`           |
| `etSchedulerBadgeTimeRange`  | The appointment's `start`–`end` time; hidden for an `allDay` one.  | `10`          |
| `etSchedulerBadgeLocation`   | A pin icon and `location`; hidden when unset.                      | `20`          |
| `etSchedulerBadgeChainCount` | A chevron and the total descendant count; hidden with no children. | `30`          |

Each takes the same `{ enabled?: boolean }` config, bound on `<et-scheduler>` under its own selector. The month view hides the color dot and the location piece in its compact one-line badge (a per-view CSS choice, not a config flag) - both still render in the time grid and the agenda view.

Adding your own piece is the same mechanism: write a directive that injects `SCHEDULER_FEATURE_HOST` (via `injectSchedulerFeatureHost()`) and calls `registerBadgeAdornment({ component, order, enabled })` from its constructor, where `component` declares a `node: InputSignal<AppointmentTreeNode>` input - the tree node the badge renders, giving it the appointment plus its depth and children.

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

`SCHEDULER_FEATURE_HOST` (injected via `injectSchedulerFeatureHost()`) is the read-only surface an opt-in scheduler feature reaches on its host `<et-scheduler>`: `appointments()` (visible-range-filtered), `appointmentTree()`, `selectedAppointment()`, the scheduler's own `element`, `registerBadgeAdornment()` / `badgeAdornments()` (see [badge composability](#badge-composability)), and `registerToolbarAction()` / `toolbarActions()` (see [toolbar](#toolbar)). It's modeled on the [table](/components/table)'s feature host. `addAppointment()` opens the default edit surface for a brand-new appointment - the same "only meaningful with that default surface" caveat as `etSchedulerActionAddAppointment`, exposed here so the built-in toolbar action can call it without importing `SchedulerComponent` directly. The [edit surface](#edit-surface) has its own, separately-scoped host - see [edit-surface feature host](#edit-surface-feature-host).

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
