import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ColorInteractiveDirective, dragGestureFrom, injectRenderer } from '@ethlete/core';
import { finalize, fromEvent, merge, Subscription, takeUntil, tap, timer } from 'rxjs';
import { IconDirective, MINUS_ICON, PLUS_ICON, provideIcons } from '../../icon';
import { NumberInputDirective, numberInputStepMultiplierFrom } from './headless';
import { injectInputLabels } from '../../forms/input/input-labels';

const STEPPER_REPEAT_DELAY = 400;
const STEPPER_REPEAT_INTERVAL = 75;

/** How far the pointer travels per `step` while scrubbing - a distance, never one unit per pixel. */
const SCRUB_PX_PER_STEP = 4;

/** Far enough that a press meant as a click never commits to a scrub. */
const SCRUB_COMMIT_THRESHOLD = 8;

/** Set on the document while a scrub runs - the pointer is captured, so the grip's own cursor is not enough. */
const SCRUB_ACTIVE_CLASS = 'et-number-input-scrubbing';

@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrl: './number-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(MINUS_ICON, PLUS_ICON)],
  hostDirectives: [
    {
      directive: NumberInputDirective,
      inputs: [
        'min',
        'max',
        'step',
        'placeholder',
        'autocomplete',
        'textAlign',
        'value',
        'mixed',
        'touched',
        'mixedLabel',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
        'maxLength',
        'pending',
        'aria-label',
        'aria-labelledby',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-number-input',
    '[attr.data-stepper]': 'stepper() || null',
    '(click)': 'numberInputDir.activate()',
  },
})
export class NumberInputComponent {
  private inputLabels = injectInputLabels();

  protected numberInputDir = inject(NumberInputDirective);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();

  /** Renders −/+ stepper buttons with press-and-hold auto-repeat. */
  public stepper = input(false, { transform: booleanAttribute });

  /** Accessible name of the increment stepper button. */
  public incrementLabel = input<string | null>(null);

  /** Accessible name of the decrement stepper button. */
  public decrementLabel = input<string | null>(null);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  /** The string in effect: this instance's `incrementLabel`, else the domain's label set. */
  protected resolvedIncrementLabel = computed(() => this.incrementLabel() ?? this.inputLabels().increment);

  /** The string in effect: this instance's `decrementLabel`, else the domain's label set. */
  protected resolvedDecrementLabel = computed(() => this.decrementLabel() ?? this.inputLabels().decrement);

  private repeatSub: Subscription | null = null;

  constructor() {
    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.numberInputDir.focusTarget.set(nativeInput);
      this.numberInputDir.nativeControl.set(nativeInput);
    });
  }

  public syncNativeValue(event: Event) {
    this.numberInputDir.syncFromNativeInput(event.target as HTMLInputElement);
  }

  protected startStepRepeat(event: PointerEvent, direction: 1 | -1) {
    // keep focus on the input (or wherever it is) instead of the button
    event.preventDefault();
    this.numberInputDir.activate();

    const button = event.currentTarget as HTMLElement;

    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture is unavailable in some test environments - stepping still works
    }

    const multiplier = numberInputStepMultiplierFrom(event);

    this.numberInputDir.stepBy(direction, { multiplier });
    this.stopStepRepeat();

    // stop on any pointer release anywhere, not just on the button: if `setPointerCapture`
    // above threw (test envs, some browsers) and the pointer lifts off the button, the button
    // never sees `pointerup`/`pointercancel` - without this document-level stop the timer would
    // run until the component is destroyed
    const release$ = merge(fromEvent(this.document, 'pointerup'), fromEvent(this.document, 'pointercancel'));

    // one immediate step above, then repeat after the hold delay and accelerate
    this.repeatSub = timer(STEPPER_REPEAT_DELAY, STEPPER_REPEAT_INTERVAL)
      .pipe(
        tap(() => this.numberInputDir.stepBy(direction, { multiplier })),
        takeUntil(release$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // a scrub is a fine-pointer gesture: on touch a horizontal drag off a 24px button is a
    // mis-grab far more often than an edit, and the buttons already refuse to scroll the page
    if (event.pointerType === 'mouse') {
      this.startScrub(event, { button, multiplier });
    }
  }

  protected stopStepRepeat() {
    this.repeatSub?.unsubscribe();
    this.repeatSub = null;
  }

  /**
   * Drag the stepper sideways to run the value, Figma-style. The press has already stepped once and
   * armed the auto-repeat by the time this can tell a drag from a click, so committing to the scrub
   * cancels the repeat and leaves that first step standing.
   *
   * The multiplier is the one the modifiers asked for at press - the gesture carries positions, not
   * key state, so a modifier pressed mid-drag does not change the sensitivity under way.
   */
  private startScrub(event: PointerEvent, { button, multiplier }: { button: HTMLElement; multiplier: number }) {
    let scrubbing = false;
    let skipCatchUpMove = false;
    let travel = 0;

    dragGestureFrom(event, button, { commitThreshold: SCRUB_COMMIT_THRESHOLD })
      .pipe(
        tap((gesture) => {
          if (gesture.type === 'start') {
            scrubbing = true;
            // the move that arrives with `start` catches up the threshold distance - counting it
            // would jump the value by two steps the instant the drag commits
            skipCatchUpMove = true;
            travel = 0;
            this.stopStepRepeat();
            this.renderer.addClass(this.document.documentElement, SCRUB_ACTIVE_CLASS);

            return;
          }

          if (!scrubbing) return;

          if (gesture.type === 'move') {
            if (skipCatchUpMove) {
              skipCatchUpMove = false;

              return;
            }

            travel += gesture.data.stepX;

            const steps = Math.trunc(travel / SCRUB_PX_PER_STEP);

            if (!steps) return;

            // keep the sub-step remainder so a slow drag still moves instead of rounding to zero
            travel -= steps * SCRUB_PX_PER_STEP;

            this.numberInputDir.stepBy(steps > 0 ? 1 : -1, {
              multiplier: Math.abs(steps) * multiplier,
              markTouched: false,
            });

            return;
          }

          if (gesture.type === 'end' || gesture.type === 'cancelled') {
            scrubbing = false;
            // the whole scrub is one edit: marking touched per step would flash a validation
            // error under the pointer every time the drag passed a bound on its way somewhere valid
            this.numberInputDir.touched.set(true);
          }
        }),
        // also on destroy - a component torn down mid-drag would otherwise leave the whole
        // document wearing the scrub cursor
        finalize(() => this.renderer.removeClass(this.document.documentElement, SCRUB_ACTIVE_CLASS)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
