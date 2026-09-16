import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { injectTicketDraft } from '../day-review/ticket-draft';
import { StandInsListComponent } from './stand-ins-list.component';

/**
 * One placeholder as its own dialog, for the band that is waiting on it.
 *
 * The id is read once, when the dialog opens, and never again: closing the create form clears the
 * draft, and a dialog that fell back to the whole list at that moment would answer a question the
 * user never asked.
 */
@Component({
  selector: 'ethlete-stand-ins',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>{{ title }}</h2>
    </div>

    <et-overlay-body>
      <ethlete-stand-ins-list [only]="only" />
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, StandInsListComponent],
  hostDirectives: [OverlayMainDirective],
})
export class StandInsComponent {
  private waiting = injectTicketDraft().standIn();

  protected only = this.waiting?.id ?? null;
  protected title = this.waiting?.name || 'Waiting on a ticket';
}

export const STAND_INS_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: StandInsComponent,
  strategies: dialogOverlayStrategy({ width: 'min(720px, 90%)', maxWidth: '90%' }),
});
