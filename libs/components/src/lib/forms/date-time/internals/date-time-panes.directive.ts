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

const COMPENSATION_DURATION = 160;
const COMPENSATION_EASING = 'ease';

/** The time picker's own rows: its columns, and a range picker's side switch above them. */
const PICKER_ROWS = '.et-time-picker-sides, .et-time-picker-columns';

/**
 * @internal Applied to the pane row of a date-time picker panel: when month navigation changes the
 * calendar height, the stretched time picker follows instantly and its vertically centered content
 * jumps by half the delta. This slides that content from its old visual position to the new one with
 * a `translateY` compensation.
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
  selector: '[etDateTimePickerPanes]',
})
export class DateTimePickerPanesDirective {
  private destroyRef = inject(DestroyRef);
  private prefersReducedMotion = injectPrefersReducedMotion();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  private calendar = contentChild<CalendarComponent, ElementRef<HTMLElement>>(CalendarComponent, {
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
      this.lastBlockSize = this.measure();
      this.ready = true;
    });

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      this.cancelAnimations();
    });
  }

  private compensate() {
    const blockSize = this.measure();

    // never record or compensate a zero / pre-layout height
    if (blockSize === null || blockSize === 0) {
      return;
    }

    const previous = this.lastBlockSize;

    this.lastBlockSize = blockSize;

    if (previous === null || Math.abs(previous - blockSize) < 1 || this.prefersReducedMotion()) {
      return;
    }

    // eslint-disable-next-line ethlete/no-dom-query -- the rows live inside et-time-picker's own view, out of reach of a content query from here
    const rows = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(PICKER_ROWS));
    const firstRow = rows[0];

    if (!firstRow) {
      return;
    }

    // the centered content moved by half the height delta; continue from the
    // current visual offset when interrupting a running compensation
    const offset = (previous - blockSize) / 2 + this.currentOffset(firstRow);

    this.cancelAnimations();

    this.animations = rows.map((row) =>
      row.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], {
        duration: COMPENSATION_DURATION,
        easing: COMPENSATION_EASING,
      }),
    );
  }

  // the panes are stretched to one row, so every time picker has the same height
  private measure() {
    // eslint-disable-next-line ethlete/no-dom-query -- see compensate()
    const timePicker = this.host.nativeElement.querySelector('.et-time-picker');

    return timePicker?.getBoundingClientRect().height ?? null;
  }

  private currentOffset(row: HTMLElement) {
    if (!this.animations.some((animation) => animation.playState === 'running')) {
      return 0;
    }

    const transform = getComputedStyle(row).transform;
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
