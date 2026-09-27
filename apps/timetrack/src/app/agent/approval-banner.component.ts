import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, createOverlayOpener } from '@ethlete/components';
import { injectApprovalQueue } from './approval-queue';
import { APPROVAL_QUEUE_OVERLAY } from './approval-queue.component';

@Component({
  selector: 'ethlete-approval-banner',
  template: `
    @if (queue.waiting().length; as count) {
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-et-surface-border bg-et-brand/10 px-3 py-2"
        role="status"
      >
        <p class="text-small">
          <span class="font-medium">{{ count === 1 ? '1 agent request waits' : count + ' agent requests wait' }}</span>
          for your approval.
        </p>

        <button (click)="dialog.open()" et-button variant="filled" size="sm">Review requests</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class ApprovalBannerComponent {
  protected queue = injectApprovalQueue();
  protected dialog = createOverlayOpener(APPROVAL_QUEUE_OVERLAY);
}
