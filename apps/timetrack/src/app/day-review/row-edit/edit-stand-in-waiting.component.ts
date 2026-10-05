import {
  Component,
  Directive,
  EnvironmentInjector,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
  runInInjectionContext,
} from '@angular/core';
import {
  Appointment,
  BUTTON_IMPORTS,
  OVERLAY_REF,
  OverlayRef,
  createOverlayOpener,
  injectSchedulerEditSurfaceHost,
} from '@ethlete/components';
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
      <div class="flex items-center gap-3 rounded-md border border-et-surface-border px-3 py-2" data-stand-in-waiting>
        <span class="min-w-0 grow text-small">
          Waiting on a ticket <span class="text-et-surface-muted">· {{ days() }}</span>
        </span>

        <button (click)="file(waiting)" class="shrink-0" et-button variant="outline" size="sm">File its ticket</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditStandInWaitingComponent {
  private store = injectStandIns();
  private tickets = injectTicketDraft();
  private surfaceRef = inject<OverlayRef>(OVERLAY_REF, { optional: true });

  public draft = input.required<WritableSignal<Appointment>>();
  /** Made on the app's injector: the press closes this surface, and the dialog outlives it. */
  private panel = runInInjectionContext(inject(EnvironmentInjector), () => createOverlayOpener(STAND_INS_OVERLAY));

  protected standIn = computed(() => {
    const id = rowEntryOf(this.draft()())?.row.standInId;

    return id ? (this.store.standIns().find((entry) => entry.id === id) ?? null) : null;
  });

  protected days = computed(() => {
    const standIn = this.standIn();
    const count = standIn ? this.store.waitingDays(standIn).length : 0;

    return count === 1 ? '1 day' : `${count} days`;
  });

  protected file(waiting: StandIn) {
    this.tickets.openForStandIn(waiting);
    this.surfaceRef?.close();
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
