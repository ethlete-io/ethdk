import { Component, ViewEncapsulation, computed, inject, viewChild } from '@angular/core';
import {
  BUTTON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
  OVERLAY_REF,
  OverlayRef,
} from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { CreateTicketPressComponent } from '../day-review/create-ticket-press.component';
import { injectTicketDraft } from '../day-review/ticket-draft';
import { injectStandIns } from './stand-ins';
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

    <div class="flex flex-wrap items-center justify-end gap-3" etOverlayFooter>
      @if (only) {
        <button (click)="remove(only)" class="mr-auto" et-text-button etProvideColor="danger">Delete</button>
      }

      @if (!press()?.isArmed()) {
        <button et-button etOverlayClose variant="outline">Close</button>
      }

      @if (isFiling()) {
        <ethlete-create-ticket-press
          [canCreate]="tickets.canCreate()"
          [isCreating]="tickets.isCreating()"
          (create)="tickets.create()"
        />
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CreateTicketPressComponent,
    OVERLAY_CONTENT_IMPORTS,
    ProvideColorDirective,
    StandInsListComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class StandInsComponent {
  private store = injectStandIns();
  private overlayRef = inject<OverlayRef>(OVERLAY_REF);
  protected tickets = injectTicketDraft();

  protected press = viewChild(CreateTicketPressComponent);
  private waiting = this.tickets.standIn();

  protected only = this.waiting?.id ?? null;
  protected title = this.waiting?.name || 'Waiting on a ticket';

  protected isFiling = computed(
    () =>
      !!this.only &&
      this.tickets.standIn()?.id === this.only &&
      !!this.tickets.form() &&
      !this.tickets.createdKey() &&
      !this.tickets.duplicateKey(),
  );

  protected remove(id: string) {
    this.store.remove(id);
    this.overlayRef.close();
  }
}

export const STAND_INS_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: StandInsComponent,
  strategies: dialogOverlayStrategy({ width: 'min(720px, 90%)', maxWidth: '90%' }),
});
