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
 * The other work a rung named for this band, and the one press that takes it instead.
 *
 * The row already books the answer ADR 0012 ranks higher, so this never withholds time. What it stops
 * is the higher rung winning silently: a remembered answer is keyed on a weekday and a duration band,
 * so it matches more calls than the one it was given for, and the band has to say which two answers
 * it had. Pressing writes the other one the way naming any row does, which also teaches the store.
 */
@Component({
  selector: 'ethlete-edit-disputed',
  template: `
    @if (other(); as rival) {
      <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3" data-disputed-naming>
        <span class="text-small">Two answers disagree about this band.</span>
        <span class="text-small text-et-surface-muted">It books {{ booked() }}, and could be {{ rival.label }}.</span>

        <div>
          <button (click)="take(rival)" et-button variant="outline" size="sm">Use {{ rival.label }}</button>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditDisputedComponent {
  private store = injectDayReview();

  public draft = input.required<WritableSignal<Appointment>>();

  protected booked = computed(() => rowEntryOf(this.draft()())?.row.issueKey ?? null);

  protected other = computed(() => {
    const row = rowEntryOf(this.draft()())?.row;

    if (!row?.issueKey) return null;
    if (row.disputedIssueKey) return { kind: 'issue' as const, id: row.disputedIssueKey, label: row.disputedIssueKey };
    if (row.disputedStandInId)
      return { kind: 'stand-in' as const, id: row.disputedStandInId, label: 'work with no ticket yet' };

    return null;
  });

  protected take(rival: { kind: 'issue' | 'stand-in'; id: string }) {
    const row = rowEntryOf(this.draft()())?.row;

    if (!row) return;
    if (rival.kind === 'issue') this.store.setIssue(row, rival.id);
    else this.store.setStandIn(row, rival.id);
  }
}

@Directive({ selector: '[ethleteEditDisputed]' })
export class EditDisputedDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditDisputed');

  constructor() {
    this.host.registerEditField({ component: EditDisputedComponent, injector: inject(Injector), order: 0 });
  }
}
