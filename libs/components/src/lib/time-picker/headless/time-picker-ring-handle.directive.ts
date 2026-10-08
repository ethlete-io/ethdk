import { DestroyRef, Directive, ElementRef, computed, inject, input, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TIME_PICKER_ERROR_CODES } from '../time-picker-errors';
import { injectTimePickerLabels } from '../time-picker-labels';
import { firstOpenMinute, lastOpenMinute, minuteToAngle, stepToOpenMinute } from './internals/time-ring';
import { TimePickerRingDirective } from './time-picker-ring.directive';
import { TimePickerDirective, TimeRangeSide } from './time-picker.directive';

const outsideRing = (element: Element): never => {
  throw new RuntimeError(
    TIME_PICKER_ERROR_CODES.RING_HANDLE_OUTSIDE_RING,
    'An [etTimePickerRingHandle] must be placed inside an [etTimePickerRing].',
    { element },
  );
};

/**
 * One handle of a time ring: carries the ARIA slider semantics and the keyboard model. Arrows move one
 * `minuteStep`, PageUp and PageDown one hour, and Home and End go to the first and last open time. A key skips a
 * blocked span. An empty handle is still focusable: its keys start from now.
 */
@Directive({
  selector: '[etTimePickerRingHandle]',
  exportAs: 'etTimePickerRingHandle',
  host: {
    role: 'slider',
    '[attr.tabindex]': 'picker.disabled() ? -1 : 0',
    '[attr.aria-disabled]': 'picker.disabled() || null',
    '[attr.data-disabled]': 'picker.disabled() || null',
    'aria-valuemin': '0',
    'aria-valuemax': '1439',
    '[attr.aria-valuenow]': 'minute()',
    '[attr.aria-valuetext]': 'valueText()',
    '[attr.aria-label]': 'resolvedLabel()',
    '[attr.data-side]': 'side()',
    '[attr.data-empty]': 'minute() === null || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-dragging]': 'dragging() || null',
    '[attr.data-pointer-focused]': 'pointerFocused() || null',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'pointerFocused.set(false)',
  },
})
export class TimePickerRingHandleDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected picker = inject(TimePickerDirective);
  private labels = injectTimePickerLabels();

  /** The end of a range this handle sets. A single time uses `start`. */
  public side = input<TimeRangeSide>('start');

  /** Accessible name. Defaults to the time label, or to the name of the end in `range` mode. */
  public label = input<string | null>(null);
  private ring = inject(TimePickerRingDirective, { optional: true }) ?? outsideRing(this.elementRef.nativeElement);

  /** The time of the handle as a minute of the day, `null` while its end is empty. */
  public minute = computed(() => this.picker.ringMinute(this.side()));

  /** The position on the ring in degrees clockwise from midnight at the top, `null` while its end is empty. */
  public angle = computed(() => {
    const minute = this.minute();

    return minute === null ? null : minuteToAngle(minute);
  });

  public active = computed(() => this.picker.mode() === 'range' && this.picker.activeSide() === this.side());

  public dragging = computed(() => this.ring.draggingSide() === this.side());

  /** Set while the current focus came from a press on the ring, so the focus ring stays off until a key press. */
  public pointerFocused = signal(false);

  protected valueText = computed(() => this.picker.ringValueText(this.side()) ?? this.labels().emptyHint);

  protected resolvedLabel = computed(() => {
    const label = this.label();

    if (label !== null) {
      return label;
    }

    if (this.picker.mode() !== 'range') {
      return this.picker.resolvedTimeLabel();
    }

    return this.side() === 'start' ? this.picker.resolvedStartLabel() : this.picker.resolvedEndLabel();
  });

  constructor() {
    const unregister = this.ring.registerHandle({
      side: () => this.side(),
      focus: (options) => this.focus(options),
    });

    inject(DestroyRef).onDestroy(unregister);
  }

  public focus(options?: FocusOptions & { origin?: 'pointer' }) {
    this.pointerFocused.set(options?.origin === 'pointer');
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  protected handleFocus() {
    if (this.picker.mode() === 'range') {
      this.picker.activeSide.set(this.side());
    }
  }

  protected handleKeydown(event: KeyboardEvent) {
    this.pointerFocused.set(false);

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const target = this.keyTarget(event.key);

    if (target === undefined) {
      return;
    }

    event.preventDefault();

    if (target !== null) {
      this.picker.commitRingMinute(this.side(), target);
    }
  }

  private keyTarget(key: string) {
    const stops = this.picker.ringStops()[this.side()];
    const step = this.picker.minuteStep();
    const anchor = this.picker.anchorTime();
    const from = this.minute() ?? anchor.getHours() * 60 + anchor.getMinutes();

    switch (key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return stepToOpenMinute(stops, { from, delta: step });
      case 'ArrowLeft':
      case 'ArrowDown':
        return stepToOpenMinute(stops, { from, delta: -step });
      case 'PageUp':
        return stepToOpenMinute(stops, { from, delta: 60 });
      case 'PageDown':
        return stepToOpenMinute(stops, { from, delta: -60 });
      case 'Home':
        return firstOpenMinute(stops);
      case 'End':
        return lastOpenMinute(stops);
      default:
        return undefined;
    }
  }
}
