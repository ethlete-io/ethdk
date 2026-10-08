import { Component, ViewEncapsulation, WritableSignal, computed, input } from '@angular/core';
import {
  Appointment,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  TIME_RANGE_INPUT_IMPORTS,
  TimeRangeValue,
} from '@ethlete/components';
import { clockDisplayFormat, formatDurationMs, roundDurationUp } from '@ethlete/timetrack';
import { injectTimetrackSettings } from '../../settings/settings';
import { rowEntryOf, TimelineEntry } from './row-appointment';

const clockOf = (date: Date) =>
  [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, '0')).join(':');

const atClock = (day: Date, clock: string) => {
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  const at = new Date(day);

  at.setHours(hours, minutes, 0, 0);

  return at;
};

@Component({
  selector: 'ethlete-edit-when',
  template: `
    <div class="flex items-start gap-3">
      <et-form-field class="min-w-0 grow">
        <et-label>When</et-label>
        <et-time-range-input
          [value]="range()"
          [displayFormat]="displayFormat()"
          [minuteStep]="15"
          (valueChange)="setRange($event)"
          clearable="false"
          startAriaLabel="Start"
          endAriaLabel="End"
          valueFormat="HH:mm"
        />
      </et-form-field>

      @if (entry()) {
        <et-form-field class="w-32 shrink-0">
          <et-label>Duration</et-label>
          <et-duration-input
            [value]="durationMs()"
            (valueChange)="setDuration($event ?? 0)"
            aria-label="Time this band logs"
            durationFormat="hh:mm"
          />
          @if (observed(); as observed) {
            <et-hint>{{ observed }} observed</et-hint>
          }
        </et-form-field>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DURATION_INPUT_IMPORTS, FORM_FIELD_IMPORTS, TIME_RANGE_INPUT_IMPORTS],
})
export class EditWhenComponent {
  private settings = injectTimetrackSettings();

  public draft = input.required<WritableSignal<Appointment<TimelineEntry>>>();

  protected displayFormat = computed(() => clockDisplayFormat(this.settings.settings().display.clock));

  protected entry = computed(() => rowEntryOf(this.draft()()));

  protected range = computed<TimeRangeValue>(() => {
    const appointment = this.draft()();

    return { start: clockOf(appointment.start), end: clockOf(appointment.end) };
  });

  protected durationMs = computed(() => {
    const appointment = this.draft()();
    const row = this.entry()?.row;

    if (row && appointment.start.getTime() === row.from.getTime() && appointment.end.getTime() === row.to.getTime()) {
      return row.durationMs;
    }

    return appointment.end.getTime() - appointment.start.getTime();
  });

  protected observed = computed(() => {
    const observedMs = this.entry()?.row.observedMs;

    if (observedMs === undefined || observedMs === this.durationMs()) return null;

    return formatDurationMs(observedMs);
  });

  protected setRange(value: TimeRangeValue) {
    this.draft().update((appointment) => {
      const start = value.start === null ? appointment.start : atClock(appointment.start, value.start);
      const end = atClock(appointment.start, value.end ?? clockOf(appointment.end));

      if (end <= start) end.setDate(end.getDate() + 1);

      if (start.getTime() === appointment.start.getTime() && end.getTime() === appointment.end.getTime()) {
        return appointment;
      }

      return { ...appointment, start, end };
    });
  }

  protected setDuration(durationMs: number) {
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
