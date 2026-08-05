# Scheduler: a composable appointment calendar

A Google-Calendar-scale feature: month/week/day/agenda views, appointments visible and
editable in place, and two axes of extensibility the classic calendar UI doesn't need -
an edit surface where built-in fields (location, description, ...) can be individually
disabled and consumers can add their own, and appointments that can nest into arbitrarily
deep parent/child chains (a project's Jira-esque "sub-appointments"), each with its own
time range on the grid.

Scope decided up front: full view parity (month, week/day time-grid, agenda) ships
together since they share one headless engine; sub-appointments get their own start/end
and render nested under their ancestor on the grid, not just in a detail list; drag-to-move/
resize and recurrence are **parked**, not built, but the data model and headless seams below
are shaped so neither requires a breaking change to retrofit.

## Naming & placement

`libs/components/src/lib/scheduler/` (public export `@ethlete/components`, e.g.
`<et-scheduler>`). Not `calendar` - that domain already exists
(`libs/components/src/lib/calendar/`) and is the month-grid *date-picker* widget used inside
`date-input`/`date-range-input`. Different domain, no shared code; the scheduler's own month
view solves a different problem (rendering appointments per cell, not picking a single date)
and gets its own bucketing logic.

## Design: three tiers

- **Tier 2 - headless (`scheduler/headless/`)**: `SchedulerDirective` (current view, focused
  date, visible range, timezone, selected appointment), one layout directive per view
  (`SchedulerMonthDirective`, `SchedulerTimeGridDirective` for week/day, `SchedulerAgendaDirective`),
  the appointment tree builder, and the feature-host (below). No template structure, no design
  tokens - pure state and geometry.
- **Tier 3 - default components (`scheduler/` root)**: `<et-scheduler>` orchestrates the active
  view + toolbar (prev/next/today/view-switch) via `hostDirectives: [SchedulerDirective]`; one
  presentational component per view; the default appointment badge/block; the default edit
  surface (a dialog built on the overlay system, per `component-architecture`). Covers the
  zero-config case - a consumer who wants every built-in field and the default badge just uses
  `<et-scheduler>` with no feature directives applied.

## Design: the feature-host is the extensibility spine

Both axes the user asked for - "edit surface extendable beyond the classics, location etc.
disable-able" and "badges composable" - are the same mechanism: a feature host modeled
directly on the table's (`libs/components/src/lib/table/headless/table-features.ts`), because
it already solves "a piece of UI built from parts that must be individually omittable and
consumer-extensible without the base component knowing about any of them."

`SCHEDULER_FEATURE_HOST` (analogous to `TABLE_FEATURE_HOST`) exposes registration points a
feature calls once from its constructor - the scheduler never queries for features, they
register into it:

- `registerBadgeAdornment(adornment)` - one piece of a badge/block's content (title text, color
  dot, time range, location icon, sub-appointment chevron + count), with `order` and `enabled`.
  The **built-ins are features too** (`SchedulerBadgeTitleDirective`,
  `SchedulerBadgeLocationDirective`, ...), applied on `<et-scheduler>` by default via its
  `*.imports.ts` aggregation, or individually - so "disable location on the badge" is just not
  applying `etSchedulerBadgeLocation`, no config flag to thread through the base component.
- `registerEditField(field)` - one form field in the edit surface, with `order`, `enabled`, and
  a component contract for get/set/validate. Same story: `etSchedulerEditTitle`,
  `etSchedulerEditTimeRange`, `etSchedulerEditLocation`, `etSchedulerEditDescription` are
  self-registering directives applied to `<et-scheduler-edit-surface>` (or bundled by default via
  its imports array); a consumer omits `etSchedulerEditLocation` to drop the field entirely, and
  adds a custom field by writing the same kind of directive - no subclassing, no giant options
  object on the root component.
- `registerAppointmentAction(action)` - an entry in the appointment's context menu / edit-surface
  toolbar (e.g. "Add sub-appointment", "Delete chain"). `order` + `enabled` again.
- `registerGridOverlay(layer)` - a floating layer the scheduler mounts after the grid, the same
  role `TableLayer` plays for the table's reorder drag ghost. Unused today; it's the seam
  drag-to-move (parked, phase 6) mounts into later without a new registration point.

This is also literally how "some parts should be able to be disabled" gets solved without a
`showLocation: boolean` input: a feature that isn't applied contributes nothing, costs nothing,
and the base component's source never mentions it - the same reasoning `AGENTS.md` already gives
for splitting a stylesheet applies to splitting the edit surface's fields.

## Design: sub-appointments as a chain, not a fixed hierarchy

An appointment's nesting is a single `parentId: AppointmentId | null` field - no `level` and no
depth limit, because Jira-esque chains genuinely go arbitrarily deep. The headless engine builds
the tree from the flat list the consumer provides (one pass, `Map<parentId, children[]>`,
recursive walk to render) - the same shape as building a tree from a flat list anywhere else in
the codebase, just without the cascader's lazy per-level loading (a scheduler's appointment set
for a visible range is already fully in memory, so there's nothing to defer).

Rendering follows the chain everywhere a badge appears:

- **Time-grid**: a child renders nested/inset within its parent's lane (its own start/end still
  place it on the time axis; the inset is purely a visual "this belongs to that" bracket, sized
  by depth, capped visually past a few levels so a 10-deep chain doesn't vanish to a sliver).
- **Month/agenda**: depth becomes indentation; a collapsed parent badge shows a count of its
  descendants (via a built-in badge adornment, so it's just as omittable as any other).
- **Edit surface**: a registered `registerAppointmentAction` for "Add sub-appointment" opens a
  new edit surface pre-filled with `parentId` set to the current appointment; the surface also
  shows the ancestor chain as a breadcrumb (walking `parentId` up) and the direct children as a
  list, each opening its own edit surface.

Overlap-packing (siblings that share time on the grid, whether or not either is a sub-appointment
of the other) is the one genuinely hard algorithm in this plan - it lives entirely in
`SchedulerTimeGridDirective` as pure geometry (assign each visible appointment a column + column
count for its overlap group), so it's unit-testable without rendering anything.

## Data model & data source

```ts
type AppointmentId = string;

type Appointment<TExtra = unknown> = {
  id: AppointmentId;
  parentId: AppointmentId | null;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  colorToken?: string; // resolves via `theming`, never a literal color
  extra?: TExtra; // open extension point - custom edit fields read/write here
};
```

The consumer passes a flat `appointments: Signal<Appointment[]>` (or a plain input, coerced the
way the table does with `data`) - the scheduler does not fetch. A `@ethlete/query` integration
(mirroring `table/headless/table-rows-from-query.ts`) is a natural later addition once a real
consumer's query shape is known; not built speculatively now.

## Phases

### Phase 0 - domain scaffold + headless engine core (M) - done

`SchedulerDirective`: view (`'month' | 'week' | 'day' | 'agenda'`), focused date, derived visible
range per view, timezone (fixed to the browser's for v1 - no per-event timezone override yet).
`SCHEDULER_FEATURE_HOST` + `injectSchedulerFeatureHost()`, modeled 1:1 on the table's
`injectTableFeatureHost`. The appointment tree builder (flat list → children map + recursive
walk) as a pure, independently-tested function - every later phase consumes it, nothing renders
yet.

### Phase 1 - month view (M)

`SchedulerMonthDirective` (day-cell bucketing, leading/trailing days from adjacent months) +
`SchedulerMonthViewComponent`. Appointments render as one-line badges per cell with a
"+N more" overflow (own popover, reuses the overlay system). Read-only click → selects an
appointment (opens edit surface once phase 5 lands; stub a selection signal until then).

### Phase 2 - time-grid view: week/day (L)

The hard phase. `SchedulerTimeGridDirective`: hour axis, pixel-per-minute geometry, the
overlap-packing algorithm (columns per concurrent group), and sub-appointment nesting insets
within a lane. Day view is the same directive with a visible range of one day - no separate
implementation. All-day appointments render in a separate strip above the hour grid, same as
Google Calendar.

### Phase 3 - agenda view (S)

`SchedulerAgendaDirective` + component: flat list grouped by day, chain depth as indentation.
Cheapest view - reuses the tree builder and the badge composability from phase 4 with no new
layout math.

### Phase 4 - badge/block composability (M)

`registerBadgeAdornment` + the built-in adornment directives (title, time range, color dot,
location icon, chain chevron/count). Wire the default `<et-scheduler>` imports to apply all of
them, so zero-config keeps today's expected look; document removing one to disable it.

### Phase 5 - edit surface (L)

`SchedulerEditSurfaceDirective` (headless: field registry, draft state, commit/cancel, validation
aggregation) + `<et-scheduler-edit-surface>` (default dialog via the overlay system). Built-in
fields as self-registering directives (`etSchedulerEditTitle`, `...TimeRange`, `...Location`,
`...Description`, `...Color`). `registerAppointmentAction` for "Add sub-appointment" / "Delete
(with descendants)"; ancestor breadcrumb + children list wired to the phase-0 tree builder.

### Parked - not planned in detail yet

- **Drag-to-move / drag-to-resize** on the time-grid. Seam: `registerGridOverlay` (phase 0) for
  the drag ghost, same role the table's `TableLayer` plays for its reorder drag. Needs its own
  plan once phase 2's geometry is settled, since the drag math depends on the packing algorithm's
  column assignment.
- **Recurrence** (RRULE-style repeating appointments). Seam: `extra` on `Appointment` is the
  escape hatch today; a real recurrence engine expands one recurring definition into concrete
  occurrences before they ever reach the flat `appointments` list the scheduler consumes, so it
  can land later without changing anything phases 0-5 build.
