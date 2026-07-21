import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ColorInteractiveDirective } from '@ethlete/core';
import { fromEvent, merge, Subscription, takeUntil, tap, timer } from 'rxjs';
import { IconDirective, MINUS_ICON, PLUS_ICON, provideIcons } from '../../icon';
import { NumberInputDirective } from './headless';

const STEPPER_REPEAT_DELAY = 400;
const STEPPER_REPEAT_INTERVAL = 75;

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
        'mixedLabel',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
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
  protected numberInputDir = inject(NumberInputDirective);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  /** Renders −/+ stepper buttons with press-and-hold auto-repeat. */
  public stepper = input(false);

  /** Accessible name of the increment stepper button. */
  public incrementLabel = input('Increment');

  /** Accessible name of the decrement stepper button. */
  public decrementLabel = input('Decrement');

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

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

    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // pointer capture is unavailable in some test environments — stepping still works
    }

    this.numberInputDir.stepBy(direction);
    this.stopStepRepeat();

    // stop on any pointer release anywhere, not just on the button: if `setPointerCapture`
    // above threw (test envs, some browsers) and the pointer lifts off the button, the button
    // never sees `pointerup`/`pointercancel` — without this document-level stop the timer would
    // run until the component is destroyed
    const release$ = merge(fromEvent(this.document, 'pointerup'), fromEvent(this.document, 'pointercancel'));

    // one immediate step above, then repeat after the hold delay and accelerate
    this.repeatSub = timer(STEPPER_REPEAT_DELAY, STEPPER_REPEAT_INTERVAL)
      .pipe(
        tap(() => this.numberInputDir.stepBy(direction)),
        takeUntil(release$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected stopStepRepeat() {
    this.repeatSub?.unsubscribe();
    this.repeatSub = null;
  }
}
