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
import { Appointment, BUTTON_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { injectDayReview } from '../day-review';
import { rowEntryOf } from './row-appointment';

/**
 * Why a band nobody watched books nothing, and the one press that decides it was the user's after all.
 *
 * The key is the one the ladder already found for this band — the day withheld it rather than
 * forgetting it. Pressing writes it the way naming any other row does, so the row becomes a proposal
 * the reviewer owns. It is deliberate, which is the whole reason the day refused to book it alone.
 */
@Component({
  selector: 'ethlete-edit-unattended',
  template: `
    @if (withheld(); as issueKey) {
      <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3" data-unattended-waiting>
        <span class="text-small">Nobody was here for this band, so it books nothing.</span>
        <span class="text-small text-et-surface-muted">The day would have called it {{ issueKey }}.</span>

        <div>
          <button (click)="book(issueKey)" et-button variant="outline" size="sm">Book it as {{ issueKey }}</button>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditUnattendedComponent {
  private store = injectDayReview();

  public draft = input.required<WritableSignal<Appointment>>();

  protected withheld = computed(() => {
    const row = rowEntryOf(this.draft()())?.row;

    return row && !row.issueKey ? (row.withheldIssueKey ?? null) : null;
  });

  protected book(issueKey: string) {
    const row = rowEntryOf(this.draft()())?.row;

    if (row) this.store.setIssue(row, issueKey);
  }
}

@Directive({ selector: '[ethleteEditUnattended]' })
export class EditUnattendedDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditUnattended');

  constructor() {
    this.host.registerEditField({ component: EditUnattendedComponent, injector: inject(Injector), order: 0 });
  }
}
