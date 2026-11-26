import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import {
  OVERLAY_REF,
  OverlayMainDirective,
  OverlayRef,
  SCHEDULER_EDIT_SURFACE_IMPORTS,
  SchedulerEditSurfaceDirective,
  injectSchedulerEditSurface,
} from '@ethlete/components';
import { callExclusionReasonOf, isStandInRow } from '@ethlete/timetrack';
import { injectAutoMode } from '../auto-mode';
import { injectBandApprovals } from '../band-approvals';
import { injectDayReview } from '../day-review';
import { EditApprovalComponent } from './edit-approval.component';
import { EditCallTranscriptComponent } from './edit-call-transcript.component';
import { EditDescriptionSourceComponent } from './edit-description-source.component';
import { EditDisputedComponent } from './edit-disputed.component';
import { EditEvidenceComponent } from './edit-evidence.component';
import { EditIssueStatusComponent } from './edit-issue-status.component';
import { EditIssueComponent } from './edit-issue.component';
import { EditMeetingComponent } from './edit-meeting.component';
import { EditStandInWaitingComponent } from './edit-stand-in-waiting.component';
import { EditStandInComponent } from './edit-stand-in.component';
import { EditStateComponent } from './edit-state.component';
import { EditUnattendedComponent } from './edit-unattended.component';
import { EditWhenComponent } from './edit-when.component';
import { RowAction, rowActionsFor } from './row-actions';
import { injectRowTicket } from './row-ticket';
import { TimelineEntry, rowEntryOf, unnamedLabelOf, waitingKeyOf } from './row-appointment';

/**
 * A row of the day on the scheduler's edit surface: the issue, the rounded duration, whether a sync
 * writes the row and the evidence behind it, with the row actions in the header menu. A range drawn
 * on empty grid opens it without a row, as the form for a new entry.
 */
@Component({
  selector: 'ethlete-row-edit-surface',
  template: `
    <et-scheduler-edit-surface-header>
      <span [title]="title()">{{ title() }}</span>

      <et-scheduler-edit-surface-actions>
        @for (action of actions(); track action.label) {
          <button
            [variant]="action.destructive ? 'destructive' : 'default'"
            (click)="run(action)"
            et-menu-item
            type="button"
          >
            {{ action.label }}
          </button>
        }
      </et-scheduler-edit-surface-actions>
    </et-scheduler-edit-surface-header>

    <et-overlay-body>
      <et-scheduler-edit-surface-breadcrumb />

      <et-scheduler-edit-surface-fields>
        @if (isDraft()) {
          @if (hasMeetings()) {
            <ethlete-edit-meeting [draft]="surface.draft" />
          }
          <ethlete-edit-issue [draft]="surface.draft" />
          <ethlete-edit-when [draft]="surface.draft" />
          <et-scheduler-edit-description [draft]="surface.draft" />
        } @else {
          <ethlete-edit-approval [draft]="surface.draft" />
          <ethlete-edit-stand-in-waiting [draft]="surface.draft" />
          <ethlete-edit-unattended [draft]="surface.draft" />
          <ethlete-edit-disputed [draft]="surface.draft" />
          <ethlete-edit-issue [draft]="surface.draft" />
          <ethlete-edit-issue-status [draft]="surface.draft" />
          @if (showsStandIn()) {
            <ethlete-edit-stand-in [draft]="surface.draft" />
          }
          <ethlete-edit-state [draft]="surface.draft" />
          <ethlete-edit-when [draft]="surface.draft" />
          <et-scheduler-edit-description [draft]="surface.draft" />
          <ethlete-edit-description-source [draft]="surface.draft" />
          <ethlete-edit-evidence [draft]="surface.draft" />
          <ethlete-edit-call-transcript [draft]="surface.draft" />
        }
      </et-scheduler-edit-surface-fields>

      <et-scheduler-edit-surface-children />
    </et-overlay-body>

    <et-scheduler-edit-surface-footer />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    SCHEDULER_EDIT_SURFACE_IMPORTS,
    EditApprovalComponent,
    EditCallTranscriptComponent,
    EditDescriptionSourceComponent,
    EditDisputedComponent,
    EditEvidenceComponent,
    EditIssueComponent,
    EditIssueStatusComponent,
    EditMeetingComponent,
    EditStandInComponent,
    EditStandInWaitingComponent,
    EditStateComponent,
    EditUnattendedComponent,
    EditWhenComponent,
  ],
  hostDirectives: [
    OverlayMainDirective,
    { directive: SchedulerEditSurfaceDirective, inputs: ['appointment', 'appointments'] },
  ],
})
export class RowEditSurfaceComponent {
  private store = injectDayReview();
  private autoMode = injectAutoMode();
  private approvals = injectBandApprovals();
  private ticket = injectRowTicket();
  private overlayRef = inject<OverlayRef>(OVERLAY_REF, { optional: true });

  protected surface = injectSchedulerEditSurface<TimelineEntry>();

  private openedRow = computed(() => rowEntryOf(this.surface.appointment())?.row ?? null);

  protected isDraft = computed(() => !this.openedRow());

  protected hasMeetings = computed(() => this.store.meetings().length > 0);

  protected showsStandIn = computed(() => {
    const draft = this.surface.draft();
    const row = rowEntryOf(draft)?.row;
    const standInRow = !!row && isStandInRow(row);

    if (!standInRow && !this.store.openStandIns().length) return false;

    return standInRow || !draft.title.trim();
  });

  private header = computed(() => {
    const row = this.openedRow();

    if (!row) return 'New entry';

    const standInName = row.standInId
      ? this.store.allStandIns().find((standIn) => standIn.id === row.standInId)?.name
      : undefined;
    const call = this.store.excludedCallOf(row);

    return unnamedLabelOf({
      row,
      standInName,
      excludedReason: call && callExclusionReasonOf(call),
      waitingKey: waitingKeyOf(this.approvals.forRow(row.id)),
    });
  });

  protected title = computed(() => this.surface.currentAppointment().title || this.header());

  /** Each acts on the row as it stands, not on the draft, and replaces it: nothing is left for a save to write. */
  protected actions = computed(() => {
    const row = rowEntryOf(this.surface.currentAppointment())?.row;

    if (!row) return [];

    return rowActionsFor({
      store: this.store,
      autoMode: this.autoMode,
      ticket: this.ticket,
      row,
      rows: this.store.rows(),
    }).filter((action) => !action.disabled);
  });

  protected run(action: RowAction) {
    action.run();
    this.overlayRef?.close();
  }
}
