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
import {
  Appointment,
  BADGE_IMPORTS,
  CHECKBOX_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  injectSchedulerEditSurfaceHost,
} from '@ethlete/components';
import { Confidence } from '@ethlete/timetrack';
import { rowEntryOf } from './row-appointment';

const CONFIDENCE_TONE: Record<Confidence, string> = {
  certain: 'text-et-success-ink',
  likely: 'text-et-surface-muted',
  weak: 'text-et-warning-ink',
};

/**
 * Whether a sync writes this row, with what the machine knows about it beside the answer: a weak row
 * is one the machine guessed at, and the reviewer has to say so before it leaves the app.
 */
@Component({
  selector: 'ethlete-edit-state',
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <et-choice-field>
        <et-checkbox [checked]="willSync()" (checkedChange)="set($event)" />
        <et-label>Log this time</et-label>
      </et-choice-field>

      <span [class]="tone()" class="text-small">{{ confidence() }}</span>

      @if (edited()) {
        <et-badge size="sm">edited</et-badge>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, CHECKBOX_IMPORTS, CHOICE_FIELD_IMPORTS],
})
export class EditStateComponent {
  public draft = input.required<WritableSignal<Appointment>>();

  private entry = computed(() => rowEntryOf(this.draft()()));

  protected willSync = computed(() => this.entry()?.willSync ?? true);
  protected confidence = computed(() => this.entry()?.row.confidence ?? 'weak');
  protected edited = computed(() => this.entry()?.row.edited ?? false);
  protected tone = computed(() => CONFIDENCE_TONE[this.confidence()]);

  protected set(willSync: boolean) {
    this.draft().update((appointment) => {
      const entry = rowEntryOf(appointment);

      return entry ? { ...appointment, extra: { ...entry, willSync } } : appointment;
    });
  }
}

@Directive({ selector: '[ethleteEditState]' })
export class EditStateDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditState');

  constructor() {
    this.host.registerEditField({ component: EditStateComponent, injector: inject(Injector), order: 5 });
  }
}
