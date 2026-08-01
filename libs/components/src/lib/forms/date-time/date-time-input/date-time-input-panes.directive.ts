import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  contentChild,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { injectPrefersReducedMotion } from '@ethlete/core';
import { CalendarComponent } from '../../../calendar';
import { TimePickerComponent } from '../../../time-picker';

const COMPENSATION_DURATION = 160;
const COMPENSATION_EASING = 'ease';

/**
 * @internal Applied to the pane row of the date-time picker panel: when month
 * navigation changes the calendar height, the stretched time picker follows
 * instantly and its vertically centered columns jump by half the delta. This
 * slides the columns from their old visual position to the new one with a
 * `translateY` compensation.
 *
 * Deliberately a transform, never an animated `block-size`: transforms stay
 * out of layout, so the panel body still changes in a single snap and the
 * panel's own resize animation (`et-date-picker-panel`, which observes the
 * body) plays one clean run alongside this one. Animating the time picker's
 * height instead would feed every animation frame back into the row height -
 * on shrink the panel would chase a per-frame moving target and finish long
 * after the columns settled.
 */
@Directive({
  selector: '[etDateTimeInputPanes]',
})
export class DateTimeInputPanesDirective {
  private destroyRef = inject(DestroyRef);
  private prefersReducedMotion = injectPrefersReducedMotion();

  private calendar = contentChild<CalendarComponent, ElementRef<HTMLElement>>(CalendarComponent, {
    read: ElementRef,
  });
  private timePicker = contentChild<TimePickerComponent, ElementRef<HTMLElement>>(TimePickerComponent, {
    read: ElementRef,
  });

  private lastBlockSize: number | null = null;
  private ready = false;
  private animations: Animation[] = [];

  constructor() {
    // starts synchronously inside the resize-observer callback - after layout,
    // before paint - so the columns never paint a frame at the jumped position.
    // A signal-routed observer would fire one change-detection cycle (= one
    // painted frame) late - same constraint as core's injectAnimatedBlockSize.
    // eslint-disable-next-line ethlete/no-native-observers -- pre-paint timing, see above
    const observer = new ResizeObserver(() => {
      if (this.ready) {
        this.compensate();
      }
    });

    effect(() => {
      const calendar = this.calendar()?.nativeElement;

      untracked(() => {
        observer.disconnect();

        if (calendar) {
          observer.observe(calendar);
        }
      });
    });

    // the settled first-render height is the baseline - opening never animates
    afterNextRender(() => {
      this.lastBlockSize = this.timePicker()?.nativeElement.getBoundingClientRect().height ?? null;
      this.ready = true;
    });

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      this.cancelAnimations();
    });
  }

  private compensate() {
    const timePicker = this.timePicker()?.nativeElement;

    if (!timePicker) {
      return;
    }

    const blockSize = timePicker.getBoundingClientRect().height;

    // never record or compensate a zero / pre-layout height
    if (blockSize === 0) {
      return;
    }

    const previous = this.lastBlockSize;

    this.lastBlockSize = blockSize;

    if (previous === null || Math.abs(previous - blockSize) < 1 || this.prefersReducedMotion()) {
      return;
    }

    // eslint-disable-next-line ethlete/no-dom-query -- the columns live inside the time picker's own view; no directive token or content query from out here can reach them
    const columns = Array.from(timePicker.querySelectorAll<HTMLElement>('.et-time-picker-column'));
    const firstColumn = columns[0];

    if (!firstColumn) {
      return;
    }

    // the centered columns moved by half the height delta; continue from the
    // current visual offset when interrupting a running compensation
    const offset = (previous - blockSize) / 2 + this.currentOffset(firstColumn);

    this.cancelAnimations();

    this.animations = columns.map((column) =>
      column.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], {
        duration: COMPENSATION_DURATION,
        easing: COMPENSATION_EASING,
      }),
    );
  }

  private currentOffset(column: HTMLElement) {
    if (!this.animations.some((animation) => animation.playState === 'running')) {
      return 0;
    }

    const transform = getComputedStyle(column).transform;
    const translateY = /matrix\(([^)]+)\)/.exec(transform)?.[1]?.split(',')[5];
    const offset = translateY === undefined ? 0 : Number(translateY);

    return Number.isFinite(offset) ? offset : 0;
  }

  private cancelAnimations() {
    for (const animation of this.animations) {
      animation.cancel();
    }

    this.animations = [];
  }
}
