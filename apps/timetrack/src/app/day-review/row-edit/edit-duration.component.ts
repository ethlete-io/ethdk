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
import { formatDurationMs, roundDurationUp } from '@ethlete/timetrack';
import { rowEntryOf } from './row-appointment';

/**
 * How much time the row logs, which is the span of the band itself — see ADR 0019. Typing a duration
 * moves the band's end, and a duration inside an increment books the whole of it.
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

  protected durationMs = computed(() => {
    const appointment = this.draft()();

    return appointment.end.getTime() - appointment.start.getTime();
  });

  protected observed = computed(() => {
    const observedMs = this.entry()?.row.observedMs;

    return observedMs === undefined ? null : formatDurationMs(observedMs);
  });

  protected set(durationMs: number) {
    this.draft().update((appointment) => {
      const entry = rowEntryOf(appointment);
      const booked = roundDurationUp(Math.max(0, durationMs));

      if (!entry || booked <= 0) return appointment;

      return {
        ...appointment,
        end: new Date(appointment.start.getTime() + booked),
        extra: { ...entry, durationMs: booked },
      };
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
