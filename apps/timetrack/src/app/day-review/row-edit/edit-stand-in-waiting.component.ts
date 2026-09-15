import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
} from '@angular/core';
import { Appointment, BUTTON_IMPORTS, createOverlayOpener, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { StandIn } from '@ethlete/timetrack';
import { STAND_INS_OVERLAY } from '../../stand-ins';
import { injectStandIns } from '../../stand-ins/stand-ins';
import { injectTicketDraft } from '../ticket-draft';
import { rowEntryOf } from './row-appointment';

/**
 * What a band waiting on a ticket is waiting for, and the one press that ends the wait.
 *
 * The press files the ticket in the stand-ins panel rather than here: the form behind it picks a
 * project, searches parents and can file the epic itself, and this surface is an anchored dialog for
 * four small fields. What belongs here is the answer to "why does this band book nothing".
 */
@Component({
  selector: 'ethlete-edit-stand-in-waiting',
  template: `
    @if (standIn(); as waiting) {
      <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3" data-stand-in-waiting>
        <span class="text-small"> {{ waiting.name }} — waiting on a ticket, so this band books nothing yet. </span>
        <span class="text-small text-et-surface-muted">{{ days() }}</span>

        <div>
          <button (click)="file(waiting)" et-button variant="outline" size="sm">File its ticket</button>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditStandInWaitingComponent {
  private store = injectStandIns();
  private tickets = injectTicketDraft();

  public draft = input.required<WritableSignal<Appointment>>();
  private panel = createOverlayOpener(STAND_INS_OVERLAY);

  protected standIn = computed(() => {
    const id = rowEntryOf(this.draft()())?.row.standInId;

    return id ? (this.store.standIns().find((entry) => entry.id === id) ?? null) : null;
  });

  protected days = computed(() => {
    const count = this.standIn()?.days.length ?? 0;

    return count === 1 ? 'It holds 1 day of work.' : `It holds ${count} days of work.`;
  });

  protected file(waiting: StandIn) {
    this.tickets.openForStandIn(waiting);
    this.panel.open();
  }
}

@Directive({ selector: '[ethleteEditStandInWaiting]' })
export class EditStandInWaitingDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditStandInWaiting');

  constructor() {
    this.host.registerEditField({
      component: EditStandInWaitingComponent,
      injector: inject(Injector),
      order: 0,
    });
  }
}
