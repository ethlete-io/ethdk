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
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  injectSchedulerEditSurfaceHost,
} from '@ethlete/components';
import { formatDurationMs } from '@ethlete/timetrack';
import { rowEntryOf } from './row-appointment';

/**
 * How much time the row logs, which the clock span above it does not decide: the day rounds its
 * durations as a whole, so a band from 09:07 to 09:53 logs three quarters of an hour.
 */
@Component({
  selector: 'ethlete-edit-duration',
  template: `
    <et-form-field>
      <et-label>Logged</et-label>
      <et-duration-input
        [value]="durationMs()"
        (valueChange)="set($event ?? 0)"
        aria-label="Time this band logs"
        durationFormat="hh:mm"
      />
      @if (observed(); as observed) {
        <et-hint>{{ observed }} observed</et-hint>
      }
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DURATION_INPUT_IMPORTS, FORM_FIELD_IMPORTS],
})
export class EditDurationComponent {
  public draft = input.required<WritableSignal<Appointment>>();

  private entry = computed(() => rowEntryOf(this.draft()()));

  protected durationMs = computed(() => this.entry()?.durationMs ?? 0);

  protected observed = computed(() => {
    const observedMs = this.entry()?.row.observedMs;

    return observedMs === undefined ? null : formatDurationMs(observedMs);
  });

  protected set(durationMs: number) {
    this.draft().update((appointment) => {
      const entry = rowEntryOf(appointment);

      return entry ? { ...appointment, extra: { ...entry, durationMs } } : appointment;
    });
  }
}

@Directive({ selector: '[ethleteEditDuration]' })
export class EditDurationDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditDuration');

  constructor() {
    this.host.registerEditField({ component: EditDurationComponent, injector: inject(Injector), order: 15 });
  }
}
