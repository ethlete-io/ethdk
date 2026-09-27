import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, SpinnerComponent } from '@ethlete/components';

/**
 * The two-step press that files a ticket. Jira holds no delete, so the first press only arms it and
 * says so; the second one files.
 */
@Component({
  selector: 'ethlete-create-ticket-press',
  template: `
    @if (isArmed()) {
      <span class="text-small text-et-surface-muted">{{ ARMED_NOTE }}</span>
      <button (click)="isArmed.set(false)" et-button variant="outline">Cancel</button>
    }

    <button [disabled]="!canCreate() || isCreating()" (click)="press()" et-button variant="filled">
      @if (isCreating()) {
        <et-spinner size="sm" />
      }
      {{ isArmed() ? 'File it now' : 'Create in Jira' }}
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, SpinnerComponent],
  host: { class: 'contents' },
})
export class CreateTicketPressComponent {
  public canCreate = input(false);
  public isCreating = input(false);

  public create = output<void>();

  public isArmed = signal(false);

  protected readonly ARMED_NOTE = 'Jira holds no delete, so a filed ticket stays whatever happens next.';

  protected press() {
    if (!this.isArmed()) {
      this.isArmed.set(true);

      return;
    }

    this.isArmed.set(false);
    this.create.emit();
  }
}
