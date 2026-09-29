import { DestroyRef, Directive, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DragGestureEvent, RuntimeError, dragGestureFrom } from '@ethlete/core';
import { tap } from 'rxjs';
import { TIME_PICKER_ERROR_CODES } from '../time-picker-errors';
import {
  RingPoint,
  TimeRingSpan,
  angleToMinute,
  clampRingMove,
  pointToAngle,
  ringDuration,
  snapMinute,
  timeRingSpans,
} from './internals/time-ring';
import { TimeRangeSide, TimePickerDirective } from './time-picker.directive';

/** A press closer to the centre than this share of the radius lands on the readout, not on the ring. */
const CENTRE_DEAD_ZONE = 0.5;

/** @internal What a handle hands the ring so a press can focus it. */
export type TimePickerRingHandleRef = {
  side: () => TimeRangeSide;
  focus: (options?: FocusOptions & { origin?: 'pointer' }) => void;
};

const outsideTimePicker = (element: Element): never => {
  throw new RuntimeError(
    TIME_PICKER_ERROR_CODES.RING_OUTSIDE_TIME_PICKER,
    'An [etTimePickerRing] must be placed inside an [etTimePicker].',
    { element },
  );
};

const ringDistance = (first: number, second: number) =>
  Math.min(ringDuration(first, second), ringDuration(second, first));

/**
 * The pointer surface of a 24h time ring, with midnight at the top. A press moves the nearest handle to the pressed
 * time, and a drag moves it on, snapped to `minuteStep`. A drag stops at the edge of a blocked span. Place the
 * `[etTimePickerRingHandle]`s inside it.
 */
@Directive({
  selector: '[etTimePickerRing]',
  exportAs: 'etTimePickerRing',
  host: {
    '[style.touch-action]': '"none"',
    '(pointerdown)': 'handlePointerDown($event)',
  },
})
export class TimePickerRingDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private picker = inject(TimePickerDirective, { optional: true }) ?? outsideTimePicker(this.elementRef.nativeElement);

  private handles = signal<readonly TimePickerRingHandleRef[]>([]);

  /** The end a drag moves right now, `null` between drags. */
  public draggingSide = signal<TimeRangeSide | null>(null);

  /** The end whose blocked spans the track draws: the active end of a range, `start` for a single time. */
  public shownSide = computed<TimeRangeSide>(() =>
    this.picker.mode() === 'range' ? this.picker.activeSide() : 'start',
  );

  public spans = computed(() => timeRingSpans(this.picker.ringStops()[this.shownSide()]));

  /** `range` mode: the arc clockwise from the start to the end, `null` until both ends are set. */
  public arc = computed<TimeRingSpan | null>(() => {
    const picker = this.picker;

    if (picker.mode() !== 'range') {
      return null;
    }

    const start = picker.ringMinute('start');
    const end = picker.ringMinute('end');

    return start === null || end === null ? null : { start, end };
  });

  public empty = computed(() => {
    const picker = this.picker;

    return picker.ringMinute('start') === null && (picker.mode() !== 'range' || picker.ringMinute('end') === null);
  });

  /** @internal */
  public registerHandle(handle: TimePickerRingHandleRef) {
    this.handles.update((handles) => [...handles, handle]);

    return () => this.handles.update((handles) => handles.filter((registered) => registered !== handle));
  }

  protected handlePointerDown(event: PointerEvent) {
    const picker = this.picker;

    if (event.button !== 0 || this.draggingSide() !== null) {
      return;
    }

    const pressMinute = this.minuteAt({ x: event.clientX, y: event.clientY }, { ignoreCentre: true });

    if (pressMinute === null) {
      return;
    }

    const side = this.sideForPress(pressMinute);

    event.preventDefault();

    // the handle's focus makes its end the active side, and the commit may hand the active side on to the end
    this.handles()
      .find((handle) => handle.side() === side)
      ?.focus({ preventScroll: true, origin: 'pointer' });
    picker.commitRingMinute(side, pressMinute);
    this.draggingSide.set(side);

    dragGestureFrom(event, this.elementRef.nativeElement, { commitThreshold: 0 })
      .pipe(
        tap((gesture) => this.applyGesture(gesture, side)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private applyGesture(gesture: DragGestureEvent, side: TimeRangeSide) {
    switch (gesture.type) {
      case 'start':
        return;
      case 'move':
      case 'end':
        this.dragTo(side, { x: gesture.data.clientX, y: gesture.data.clientY });

        if (gesture.type === 'end') {
          this.draggingSide.set(null);
        }

        return;
      case 'cancelled':
      case 'tapped':
        this.draggingSide.set(null);

        return;
    }
  }

  private dragTo(side: TimeRangeSide, point: RingPoint) {
    const picker = this.picker;
    const target = this.minuteAt(point, { ignoreCentre: false });
    const from = picker.ringMinute(side);

    if (target === null) {
      return;
    }

    picker.commitRingMinute(side, from === null ? target : clampRingMove(picker.ringStops()[side], { from, target }));
  }

  private sideForPress(minute: number): TimeRangeSide {
    const picker = this.picker;

    if (picker.mode() !== 'range') {
      return 'start';
    }

    const active = picker.activeSide();
    const other = active === 'start' ? 'end' : 'start';
    const activeMinute = picker.ringMinute(active);
    const otherMinute = picker.ringMinute(other);

    if (activeMinute === null || otherMinute === null) {
      return active;
    }

    return ringDistance(minute, otherMinute) < ringDistance(minute, activeMinute) ? other : active;
  }

  private minuteAt(point: RingPoint, options: { ignoreCentre: boolean }) {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const distance = Math.hypot(point.x - center.x, point.y - center.y);

    if (options.ignoreCentre && distance < (rect.width / 2) * CENTRE_DEAD_ZONE) {
      return null;
    }

    return snapMinute(angleToMinute(pointToAngle(point, center)), this.picker.minuteStep());
  }
}
