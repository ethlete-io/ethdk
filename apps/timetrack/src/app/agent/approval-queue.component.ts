import { Component, EnvironmentInjector, ViewEncapsulation, inject, runInInjectionContext } from '@angular/core';
import {
  BUTTON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OVERLAY_REF,
  OverlayRef,
  createOverlayOpener,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { Router } from '@angular/router';
import { ProvideColorDirective } from '@ethlete/core';
import { AgentApproval, approvalClassOf, autoModeTargetOf, describeApproval } from '@ethlete/timetrack';
import { injectBandApprovals } from '../day-review/band-approvals';
import { injectDayReview } from '../day-review/day-review';
import { formatClockTime } from '../day-review/format';
import { injectTimetrackSettings } from '../settings/settings';
import { STAND_INS_OVERLAY } from '../stand-ins';
import { injectTicketDraft } from '../day-review/ticket-draft';
import { injectApprovalQueue } from './approval-queue';

@Component({
  selector: 'ethlete-approval-queue',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Waiting requests</h2>
    </div>

    <et-overlay-body>
      @if (queue.failure(); as failure) {
        <p class="mb-3 text-small text-et-error">{{ failure }}</p>
      }

      @if (queue.waiting().length) {
        <div class="flex flex-col gap-3">
          @for (item of queue.waiting(); track item.id) {
            <div
              [attr.data-approval]="item.id"
              [attr.data-op]="item.request.op"
              [attr.data-class]="classOf(item)"
              class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3"
            >
              <span class="text-base">{{ describe(item) }}</span>

              <div class="flex flex-wrap items-center gap-2 text-small text-et-surface-muted">
                <span>{{ item.client ?? 'CLI' }} · asked at {{ askedAt(item) }}</span>

                @if (classOf(item) === 'human-only') {
                  <span class="rounded-sm bg-et-warning/15 px-2 text-et-warning-ink">Only approved one by one</span>
                }
              </div>

              <div class="flex items-center justify-end gap-3">
                @if (locatorOf(item); as locator) {
                  <button (click)="show(item)" class="mr-auto" data-show et-text-button>{{ locator }}</button>
                }

                @if (item.state === 'running') {
                  <span class="text-small text-et-surface-muted">Carrying it out…</span>
                } @else {
                  <button (click)="queue.reject(item.id)" et-text-button etProvideColor="danger">Reject</button>
                  <button (click)="queue.approve(item.id)" et-text-button>Approve</button>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="text-small text-et-surface-muted">Nothing waits for your approval.</p>
      }
    </et-overlay-body>

    <div class="flex flex-wrap items-center justify-end gap-3" etOverlayFooter>
      <button et-button etOverlayClose variant="outline">Close</button>

      @if (queue.approvableByAll().length; as count) {
        <button (click)="queue.approveAll()" et-button>Approve all ({{ count }})</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, ProvideColorDirective],
  hostDirectives: [OverlayMainDirective],
})
export class ApprovalQueueComponent {
  protected queue = injectApprovalQueue();
  private settings = injectTimetrackSettings();
  private router = inject(Router);
  private placed = injectBandApprovals();
  private tickets = injectTicketDraft();
  private dayReview = injectDayReview();
  private overlayRef = inject<OverlayRef>(OVERLAY_REF, { optional: true });
  private standIns = runInInjectionContext(inject(EnvironmentInjector), () => createOverlayOpener(STAND_INS_OVERLAY));

  protected locatorOf(item: AgentApproval) {
    if (this.placed.firstRowOf(item.id)) return 'Show on the day';
    if (this.standInOf(item)) return 'Show in stand-ins';

    return this.placed.otherDayOf(item) ? 'Show on the day' : null;
  }

  protected show(item: AgentApproval) {
    const onScreen = !!this.placed.firstRowOf(item.id);
    const standIn = onScreen ? null : this.standInOf(item);
    const day = onScreen || standIn ? null : this.placed.otherDayOf(item);

    this.overlayRef?.close();

    if (standIn) {
      this.tickets.openForStandIn(standIn);
      this.standIns.open();

      return;
    }

    if (!onScreen && !day) return;

    if (day) this.dayReview.goToDay(day);

    this.placed.reveal(item.id);
    void this.router.navigateByUrl('/day');
  }

  protected classOf(item: AgentApproval) {
    return approvalClassOf(item, this.settings.settings().actionClasses);
  }

  protected describe(item: AgentApproval) {
    return describeApproval(item.request);
  }

  protected askedAt(item: AgentApproval) {
    return formatClockTime(new Date(item.askedAtMs));
  }

  private standInOf(item: AgentApproval) {
    const { request } = item;
    const subject = request.op === 'jira.create' ? autoModeTargetOf(item.target)?.subject : undefined;
    const id =
      request.op === 'standIn.resolve' || request.op === 'standIn.remove' || request.op === 'standIn.rename'
        ? request.id
        : subject?.kind === 'stand-in'
          ? subject.standInId
          : null;

    return this.settings.settings().standIns.find((entry) => entry.id === id) ?? null;
  }
}

export const APPROVAL_QUEUE_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: ApprovalQueueComponent,
  strategies: dialogOverlayStrategy({ width: 'min(560px, 90%)', maxWidth: '90%' }),
});
