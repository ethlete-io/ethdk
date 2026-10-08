# Scheduler edit surface: an app-owned component, with a default variant

Replaces the open decisions SS-02 and SS-04 in `dx-scan-2026-10-02/sched-stream.md`. Decided 2026-10-08.

## The problem

The edit surface is extended through a registry. A field is a component plus a directive whose only job is
`registerEditField`. The directive goes on `<et-scheduler-edit-surface>` as a host directive, and the surface stamps
the field with `ngComponentOutlet`. This causes these problems, all visible in
`apps/timetrack/src/app/day-review/row-edit/`:

- 11 fields need 11 directives that only register a component.
- The built-in fields are opt-out by string key: six `inputBinding('etSchedulerEditTitle', () => DISABLED)` lines in
  `row-edit-surface.ts`. The compiler checks none of them. A new built-in field appears in timetrack with no warning.
- `<et-scheduler>` cannot take custom fields at all (SS-02).
- The field contract is `draft: InputSignal<WritableSignal<Appointment>>` with `extra: unknown`, so each field casts
  `extra` (SS-04).
- `order` is a global number that a field must fit between the built-in numbers.
- The header can only change through a `SCHEDULER_LABELS` injector (`untitledAppointment`).
- An appointment action injects `OVERLAY_REF` to close the surface.
- Timetrack builds its own opener with `createOverlaySingleSlot` and two `createOverlayOpener` calls.

## The decision

The app writes its own edit surface component with a normal template. The SDK ships the headless directive, small
building blocks, the built-in fields as plain components, and a default surface that is a composition of these. This
is the three-tier pattern from the `component-architecture` skill.

The registry goes away: `registerEditField`, `registerAppointmentAction`, `editFields()`, `appointmentActions()`,
`SCHEDULER_EDIT_SURFACE_HOST`, `injectSchedulerEditSurfaceHost`, and the `etSchedulerEdit*` /
`etSchedulerAction*` feature directives. Two ways to extend one surface is the confusion this plan removes.

Breaking change: yes. The only users are timetrack and the scheduler stories and scenarios. ea-frontend does not use
the edit surface (checked 2026-10-08).

Cost: an app that wants "the default plus one field" copies the default template. The building blocks keep that copy
at about 15 lines. Put that template in the guide, so a copy starts from a known-good version.

## Target shape

```ts
@Component({
  selector: 'ethlete-row-edit-surface',
  hostDirectives: [{ directive: SchedulerEditSurfaceDirective, inputs: ['appointment', 'appointments'] }],
  imports: [SCHEDULER_EDIT_SURFACE_IMPORTS, EditIssueComponent, EditWhenComponent],
  template: `
    <et-scheduler-edit-surface-header>{{ header() }}</et-scheduler-edit-surface-header>

    <et-overlay-body>
      <et-scheduler-edit-issue [draft]="surface.draft" />
      @if (!isDraft()) {
        <ethlete-edit-state [draft]="surface.draft" />
      }
      <et-scheduler-edit-description [draft]="surface.draft" />
    </et-overlay-body>

    <et-scheduler-edit-surface-footer [canSave]="valid()" />
  `,
})
export class RowEditSurfaceComponent {
  protected surface = injectSchedulerEditSurface<TimelineEntry>();
}

provideSchedulerEditSurface({ component: RowEditSurfaceComponent });
```

## Phases

### 1. SDK: the headless directive and the openers

- Make `provideSchedulerEditSurface({ component? })` build the edit overlay and the add overlay for any component,
  with the dialog strategies of `SCHEDULER_EDIT_SURFACE_OVERLAY` / `SCHEDULER_ADD_SURFACE_OVERLAY`. No argument means
  the default surface.
- Add `injectSchedulerEditSurface<TExtra>()`: it returns the host's `SchedulerEditSurfaceDirective<TExtra>`. One cast
  in the SDK, none in the app.
- Make `commit()` and `requestDelete()` close the overlay with a `SchedulerEditSurfaceResult<TExtra>`. Today the
  component does that.
- Add an opener for a bare `[etScheduler]`, such as `injectSchedulerEditSurfaceOpener()` with `openEdit` / `openAdd`.
  It replaces the slot and opener setup in timetrack. `<et-scheduler>` uses it too: move its three openers
  (`scheduler.component.ts:156-182`) and the `EDIT_SURFACE_NOT_REGISTERED` checks into the new opener. The
  single-slot behavior (one surface at a time) moves into the opener as well; timetrack needs it.
- Make `SchedulerEditSurfaceResult` and the `<et-scheduler>` outputs generic over `TExtra` where the types allow it.
  SS-04 stays partly open for `<et-scheduler>` itself (see its status note): a component generic needs the
  `appointments` rename.

Status: done (7ff23cc87)

### 2. SDK: building blocks and built-in fields

- Split `scheduler-edit-surface.component.html` into exported blocks: header (title plus action menu), breadcrumb,
  children list, footer (cancel, and save with a `canSave` input).
- The action menu takes actions in its content (`et-menu-item` buttons), not a registered list.
- The built-in fields (`SchedulerEditTitleComponent`, time range, location, description, color) become public
  components with a typed `draft` input. Add-sub-appointment and delete become ready-made menu items.
- Export the lot as `SCHEDULER_EDIT_SURFACE_IMPORTS`.
- Rebuild `<et-scheduler-edit-surface>` as a template of these blocks, with no host feature directives. Its look and
  behavior must not change: check it in Storybook against the stories before the change.
- Delete the registry and the feature directives listed above. Delete the error code of
  `injectSchedulerEditSurfaceHost` or mark it as unused, as the scheduler error codes do for removed codes.

Status: done (cf60c5882). The deletions of the old directive files landed in cfc506ce6 by accident (shared index).

### 3. Timetrack

- Write `RowEditSurfaceComponent` with the 11 fields in its template. `@if` replaces each `enabled` signal, and a
  check for the draft replaces the second directive list in `openDraft`.
- Delete the 11 directives. Each `Edit*Component` keeps only the component, with a typed `draft` input.
- Put `ROW_ACTIONS` into the action menu as menu items. `RowActionsDirective` goes away.
- Replace the opener setup, the `DISABLED` bindings and the labels injector in `row-edit-surface.ts`.
- Run the timetrack snapshot before and after (see AGENTS.md). Run the timetrack e2e suite.

### 4. Docs, stories, tests

- Rewrite "Edit surface", "Fields", "Extending the edit surface", "Actions" and "Edit-surface feature host" in
  `apps/docs/components/scheduler.md`. Put the default template in the guide as the start for a copy.
- Add a story with a custom surface (this is the `CustomEditField` story that `dx-scan-2026-10-02/REPORT.md` lists as
  blocked on SS-02).
- Rewrite `libs/components/src/scenarios/scheduler-composition.scenario.spec.ts` for the new shape.
- Changesets for `@ethlete/components` (breaking) and `timetrack-app`. Use the `changeset` skill for the levels.

Status: done (4bf442c3c). The `timetrack-app` changeset belongs to phase 3.

## Decided questions (2026-10-08)

- `<et-scheduler>` uses the new opener from phase 1. There is one code path for a registered surface.
- The default surface stays a registered component: the no-argument `provideSchedulerEditSurface()`.
