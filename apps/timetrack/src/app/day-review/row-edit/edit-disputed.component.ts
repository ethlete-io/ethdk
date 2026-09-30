import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Appointment, BUTTON_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { injectJiraCatalog } from '../../jira';
import { injectDayReview } from '../day-review';
import { rowEntryOf } from './row-appointment';

/**
 * The other work a rung named for this band, one press that keeps the booked answer and one that takes
 * the other instead.
 *
 * The row already books the answer ADR 0012 ranks higher, so this never withholds time. What it stops
 * is the higher rung winning silently: a remembered answer is keyed on a weekday and a duration band,
 * so it matches more calls than the one it was given for, and the band has to say which two answers
 * it had. Taking the other one writes it the way naming any row does, which also teaches the store;
 * keeping pins the booked key on this row alone, so the rival's remembered answer stays as it was.
 */
@Component({
  selector: 'ethlete-edit-disputed',
  template: `
    @if (other(); as rival) {
      <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3" data-disputed-naming>
        <span class="text-small">Two answers disagree about this band.</span>
        <span class="text-small text-et-surface-muted"
          >It books {{ describe(booked()) }}, and could be {{ describe(rival.label, rival.kind) }}.</span
        >

        <div class="flex flex-wrap gap-2">
          <button (click)="keep()" et-button variant="filled" size="sm">Keep {{ booked() }}</button>
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
  private catalog = injectJiraCatalog();

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

  constructor() {
    effect(() => {
      const keys = [this.booked(), this.other()?.kind === 'issue' ? this.other()?.id : null].filter(
        (key): key is string => !!key,
      );

      untracked(() => this.catalog.askForIssueKeys(keys));
    });
  }

  protected describe(key: string | null, kind: 'issue' | 'stand-in' = 'issue') {
    if (!key) return '';

    const summary = kind === 'issue' ? this.catalog.issueForKey(key)?.summary : undefined;

    return summary ? `${key} ${summary}` : key;
  }

  protected keep() {
    const row = rowEntryOf(this.draft()())?.row;

    if (row) this.store.keepIssue(row);
  }

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
