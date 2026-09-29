import { Component, ViewEncapsulation, computed, inject, viewChild } from '@angular/core';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateValue } from '../forms/date-time/internals/date-value';
import { TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective, TimeRangeSide } from './headless';
import { MINUTES_PER_DAY, RingCircle, angleToPoint, minuteToAngle, ringDuration } from './headless/internals/time-ring';
import { injectTimePickerLabels } from './time-picker-labels';

const CENTER = 140;
const TRACK: RingCircle = { x: CENTER, y: CENTER, radius: 112 };
const LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

type TimePickerTrack = {
  full: boolean;
  open: string[];
  blocked: string[];
  allBlocked: boolean;
};

type TimePickerReadout = {
  main: string;
  note: string | null;
  kind: 'time' | 'duration' | 'empty';
};

const round = (value: number) => Math.round(value * 100) / 100;

const pointAt = (minute: number, radius: number) => {
  const point = angleToPoint(minuteToAngle(minute), { x: CENTER, y: CENTER, radius });

  return { x: round(point.x), y: round(point.y) };
};

const arcPath = (start: number, end: number) => {
  const duration = ringDuration(start, end);

  if (duration === 0) {
    return null;
  }

  const from = pointAt(start, TRACK.radius);
  const to = pointAt(end, TRACK.radius);

  return `M ${from.x} ${from.y} A ${TRACK.radius} ${TRACK.radius} 0 ${duration > MINUTES_PER_DAY / 2 ? 1 : 0} 1 ${to.x} ${to.y}`;
};

const ringTicks = () =>
  Array.from({ length: 24 }, (_, hour) => {
    const outer = pointAt(hour * 60, 94);
    const inner = pointAt(hour * 60, hour % 3 === 0 ? 88 : 91);

    return { hour, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
  });

const sunRays = (sun: { x: number; y: number }) =>
  Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;

    return {
      index,
      x1: round(sun.x + 5.2 * Math.cos(angle)),
      y1: round(sun.y + 5.2 * Math.sin(angle)),
      x2: round(sun.x + 7.6 * Math.cos(angle)),
      y2: round(sun.y + 7.6 * Math.sin(angle)),
    };
  });

@Component({
  selector: 'et-time-picker',
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [TimePickerRingDirective, TimePickerRingHandleDirective],
  hostDirectives: [
    {
      directive: TimePickerDirective,
      inputs: [
        'mode',
        'format',
        'locale',
        'minuteStep',
        'secondStep',
        'min',
        'max',
        'timeFilter',
        'hoursLabel',
        'minutesLabel',
        'secondsLabel',
        'periodLabel',
        'startLabel',
        'endLabel',
        'value',
        'rangeValue',
        'activeSide',
        'day',
        'rangeDays',
      ],
      outputs: ['valueChange', 'rangeValueChange', 'activeSideChange', 'timeSelect', 'rangeHandOff'],
    },
  ],
  host: {
    class: 'et-time-picker',
    '[attr.data-mode]': 'timePicker.mode()',
  },
})
export class TimePickerComponent {
  protected timePicker = inject(TimePickerDirective);
  private labels = injectTimePickerLabels();
  private ring = viewChild(TimePickerRingDirective);

  protected readonly CENTER = CENTER;
  protected readonly RADIUS = TRACK.radius;
  protected readonly ticks = ringTicks();
  protected readonly MOON = { x: CENTER - 6, y: CENTER - 46 - 6 };
  protected readonly sun = pointAt(MINUTES_PER_DAY / 2, 46);
  protected readonly sunRays = sunRays(this.sun);

  protected twelveHour = computed(() => this.timePicker.formatSpec().hourCycle === 12);

  protected hourLabels = computed(() => {
    const twelveHour = this.twelveHour();
    const locale = this.timePicker.effectiveLocale();

    return LABEL_HOURS.map((hour) => {
      const text = twelveHour
        ? (formatDateValue(new Date(2000, 0, 1, hour), { format: hour % 6 === 0 ? 'h a' : 'h', locale }) ?? '')
        : String(hour).padStart(2, '0');
      const at = pointAt(hour * 60, text.length > 2 ? 68 : 74);

      return { hour, text, x: at.x, y: at.y };
    });
  });

  protected track = computed<TimePickerTrack>(() => {
    const spans = this.ring()?.spans();
    const step = this.timePicker.minuteStep();

    if (!spans || spans.blocked.length === 0) {
      return { full: true, open: [], blocked: [], allBlocked: false };
    }

    const paths = (list: (string | null)[]) => list.filter((path) => path !== null);

    return {
      full: false,
      open: paths(
        spans.open.map((span) =>
          span.start === span.end ? arcPath(span.start - step / 2, span.end + step / 2) : arcPath(span.start, span.end),
        ),
      ),
      blocked: paths(spans.blocked.map((span) => arcPath(span.start - step, span.end + step))),
      allBlocked: spans.open.length === 0,
    };
  });

  protected arc = computed(() => {
    const arc = this.ring()?.arc();

    return arc ? arcPath(arc.start, arc.end) : null;
  });

  protected readout = computed<TimePickerReadout>(() => {
    const picker = this.timePicker;
    const labels = this.labels();

    if (picker.mode() !== 'range') {
      const time = picker.ringValueText('start');

      return time === null ? this.emptyReadout() : { main: time, note: this.dayText(picker.day()), kind: 'time' };
    }

    const days = picker.rangeDays();
    const start = picker.ringMinute('start');
    const end = picker.ringMinute('end');

    if (days === null && start !== null && end !== null) {
      return {
        main: this.formatDuration(ringDuration(start, end)),
        note: this.endsNextDay() ? labels.endsNextDay : null,
        kind: 'duration',
      };
    }

    const active = picker.activeSide();
    const time = picker.ringValueText(active);

    if (time === null) {
      return this.emptyReadout();
    }

    return { main: time, note: this.dayText(days?.[active] ?? null) ?? this.sideLabel(active), kind: 'time' };
  });

  private endsNextDay() {
    const { start, end } = this.timePicker.rangeValue();

    if (start === null || end === null) {
      return false;
    }

    const days = differenceInCalendarDays(end, start);

    return days === 0
      ? end.getHours() * 60 + end.getMinutes() < start.getHours() * 60 + start.getMinutes()
      : days === 1;
  }

  private dayText(day: Date | null) {
    return day === null
      ? null
      : formatDateValue(day, { format: 'EEE d MMM', locale: this.timePicker.effectiveLocale() });
  }

  private emptyReadout(): TimePickerReadout {
    return { main: '--:--', note: this.labels().emptyHint, kind: 'empty' };
  }

  private sideLabel(side: TimeRangeSide) {
    return side === 'start' ? this.timePicker.resolvedStartLabel() : this.timePicker.resolvedEndLabel();
  }

  private formatDuration(duration: number) {
    const labels = this.labels();
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const hoursText = `${hours} ${labels.durationHours}`;
    const minutesText = `${minutes} ${labels.durationMinutes}`;

    if (hours === 0) {
      return minutesText;
    }

    return minutes === 0 ? hoursText : `${hoursText} ${minutesText}`;
  }
}
