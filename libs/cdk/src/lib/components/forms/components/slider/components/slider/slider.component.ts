import { Directionality } from '@angular/cdk/bidi';
import { AsyncPipe, DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewEncapsulation,
  booleanAttribute,
  contentChild,
  inject,
  numberAttribute,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { clamp, createDestroy, signalHostAttributes, signalHostClasses } from '@ethlete/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';
import { FormFieldStateService } from '../../../../services';
import { SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN } from '../../directives/slider-thumb-content-template';

const isTouchEvent = (event: Event): event is TouchEvent => {
  return event.type[0] === 't';
};

const getTouchIdForSlider = (event: TouchEvent, slider: HTMLElement) => {
  for (let i = 0; i < event.touches.length; i++) {
    const target = event.touches[i]!.target as HTMLElement;

    if (slider === target || slider.contains(target)) {
      return event.touches[i]!.identifier;
    }
  }

  return null;
};

const findMatchingTouch = (touches: TouchList, id: number) => {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i]!.identifier === id) {
      return touches[i];
    }
  }

  return null;
};

const getPointerPositionOnPage = (event: MouseEvent | TouchEvent, id: number | null) => {
  let point: { clientX: number; clientY: number } | null;

  if (isTouchEvent(event)) {
    if (typeof id === 'number') {
      point = findMatchingTouch(event.touches, id) || findMatchingTouch(event.changedTouches, id) || null;
    } else {
      point = event.touches[0] || event.changedTouches[0] || null;
    }
  } else {
    point = event;
  }

  return point ? { x: point.clientX, y: point.clientY } : null;
};

@Component({
  selector: 'et-slider',
  templateUrl: './slider.component.html',
  styleUrls: ['./slider.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slider',
    role: 'slider',
    '[id]': '_input.id',
  },
  imports: [AsyncPipe, NgTemplateOutlet],
  hostDirectives: [{ directive: InputDirective, inputs: ['autocomplete'] }],
})
export class SliderComponent implements OnInit {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _dirService = inject(Directionality);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroy$ = createDestroy();

  private readonly _mouseDown$ = fromEvent<MouseEvent>(this._elementRef.nativeElement, 'mousedown', { passive: false });
  private readonly _touchStart$ = fromEvent<TouchEvent>(this._elementRef.nativeElement, 'touchstart', {
    passive: false,
  });
  private readonly _keyDown$ = fromEvent<KeyboardEvent>(this._elementRef.nativeElement, 'keydown', { passive: false });
  private readonly _keyUp$ = fromEvent<KeyboardEvent>(this._elementRef.nativeElement, 'keyup', { passive: false });

  protected readonly _input = inject<InputDirective<number>>(INPUT_TOKEN);
  private readonly _formFieldStateService = inject(FormFieldStateService);

  @Input()
  get min(): number {
    return this._min$.value;
  }
  set min(value: unknown) {
    this._min$.next(numberAttribute(value, 0));
  }
  private _min$ = new BehaviorSubject(0);

  @Input()
  get max(): number {
    return this._max$.value;
  }
  set max(value: unknown) {
    this._max$.next(numberAttribute(value, 100));
  }
  private _max$ = new BehaviorSubject(100);

  @Input()
  get step(): number {
    return this._step$.value;
  }
  set step(value: unknown) {
    this._step$.next(numberAttribute(value, 1));
  }
  private _step$ = new BehaviorSubject(1);

  @Input()
  get vertical(): boolean {
    return this._vertical$.value;
  }
  set vertical(value: unknown) {
    this._vertical$.next(booleanAttribute(value));
  }
  private _vertical$ = new BehaviorSubject(false);

  @Input()
  get inverted(): boolean {
    return this._inverted$.value;
  }
  set inverted(value: unknown) {
    this._inverted$.next(booleanAttribute(value));
  }
  private _inverted$ = new BehaviorSubject(false);

  @Input({ transform: booleanAttribute })
  get renderValueTooltip(): boolean {
    return this._renderValueTooltip$.value;
  }
  set renderValueTooltip(value: boolean) {
    this._renderValueTooltip$.next(value);
  }
  private _renderValueTooltip$ = new BehaviorSubject(false);

  sliderThumbContentTemplate = contentChild(SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN);

  private readonly _dir$ = this._dirService.change.pipe(startWith(this._dirService.value));

  private readonly _value$ = combineLatest([this._input.value$, this._min$, this._max$]).pipe(
    map(([value, min, max]) => clamp(value ?? 0, min, max)),
  );

  private readonly _roundToDecimal$ = this._step$.pipe(
    map((step) => {
      const stepString = step.toString();

      return stepString.includes('.') ? stepString.split('.')[1]!.length : 0;
    }),
  );

  private readonly _percent$ = combineLatest([this._value$, this._min$, this._max$]).pipe(
    map(([value, min, max]) => (value - min) / (max - min)),
  );
  private readonly _shouldInvertAxis$ = combineLatest([this._vertical$, this._inverted$]).pipe(
    map(([vertical, inverted]) => (vertical ? !inverted : inverted)),
  );
  private readonly _shouldInvertMouseCoords$ = combineLatest([
    this._vertical$,
    this._shouldInvertAxis$,
    this._dir$,
  ]).pipe(
    map(([vertical, shouldInvertAxis, dir]) => (dir === 'rtl' && !vertical ? !shouldInvertAxis : shouldInvertAxis)),
  );
  private readonly _sliderDimensions$ = new BehaviorSubject(this._elementRef.nativeElement.getBoundingClientRect());

  protected readonly valueText$ = combineLatest([this._value$, this._roundToDecimal$]).pipe(
    map(([value, roundToDecimal]) => value.toFixed(roundToDecimal)),
  );

  protected readonly trackBackgroundStyles$ = combineLatest([this._percent$, this._vertical$]).pipe(
    map(([percent, vertical]) => {
      const scale = vertical ? `1, ${1 - percent}, 1` : `${1 - percent}, 1, 1`;

      return {
        transform: `scale3d(${scale})`,
      };
    }),
  );

  protected readonly trackFillStyles$ = combineLatest([this._percent$, this._vertical$]).pipe(
    map(([percent, vertical]) => {
      const scale = vertical ? `1, ${percent}, 1` : `${percent}, 1, 1`;

      return {
        transform: `scale3d(${scale})`,
        display: percent === 0 ? 'none' : '',
      };
    }),
  );

  protected readonly thumbContainerStyles$ = combineLatest([
    this._percent$,
    this._shouldInvertMouseCoords$,
    this._vertical$,
    this._dir$,
  ]).pipe(
    map(([percent, shouldInvertMouseCoords, vertical, dir]) => {
      const axis = vertical ? 'Y' : 'X';
      const invertOffset = dir === 'rtl' && !vertical ? !shouldInvertMouseCoords : shouldInvertMouseCoords;
      const offset = (invertOffset ? percent : 1 - percent) * 100;
      const sign = vertical ? '-' : dir === 'rtl' ? '' : '-';

      return {
        transform: `translate${axis}(${sign}${offset}%)`,
      };
    }),
  );

  protected readonly isSlidingVia$ = new BehaviorSubject<'keyboard' | 'pointer' | null>(null);
  protected readonly disableAnimations$ = new BehaviorSubject(false);
  protected readonly touchId$ = new BehaviorSubject<number | null>(null);
  protected readonly lastPointerEvent$ = new BehaviorSubject<MouseEvent | TouchEvent | null>(null);

  readonly hostClassBindings = signalHostClasses({
    'et-slider--is-sliding': toSignal(this.isSlidingVia$),
    'et-slider--inverted': toSignal(this._inverted$),
    'et-slider--disable-animations': toSignal(this.disableAnimations$),
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-orientation': toSignal(this._vertical$.pipe(map((vertical) => (vertical ? 'vertical' : 'horizontal')))),
    'aria-disabled': toSignal(this._input.disabled$),
    'aria-valuenow': toSignal(this._value$),
    'aria-valuemin': toSignal(this._min$),
    'aria-valuemax': toSignal(this._max$),
    'aria-valuetext': toSignal(this.valueText$),
    tabindex: toSignal(this._input.disabled$.pipe(map((disabled) => (disabled ? -1 : 0)))),
    'aria-labeledby': this._formFieldStateService.labelId,
    'aria-describedby': this._formFieldStateService.describedBy,
  });

  ngOnInit(): void {
    merge(this._mouseDown$, this._touchStart$)
      .pipe(
        filter((event) => {
          const isDisabled = this._input.disabled;
          const isSliding = !!this.isSlidingVia$.value;
          const isInvalidMouseButton = !isTouchEvent(event) && event.button !== 0;

          return !isDisabled && !isSliding && !isInvalidMouseButton;
        }),
        switchMap((event) =>
          combineLatest([of(event), this._freshSliderDimensions(), this._shouldInvertMouseCoords$]).pipe(
            tap(([event, sliderDimensions, shouldInvertMouseCoords]) => {
              this._elementRef.nativeElement.focus();

              this._initializeSlide(event, sliderDimensions, shouldInvertMouseCoords);
            }),
          ),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._keyDown$
      .pipe(
        filter((event) => {
          const isDisabled = this._input.disabled;
          const isSliding = this.isSlidingVia$.value && this.isSlidingVia$.value !== 'keyboard';
          const isModifierPressed = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.metaKey;

          return !isDisabled && !isSliding && !isModifierPressed;
        }),
        takeUntil(this._destroy$),
        withLatestFrom(this._dir$),
        tap(([event, dir]) => this._updateSliderViaKeyboard(event, dir)),
      )
      .subscribe();

    this._keyUp$
      .pipe(
        takeUntil(this._destroy$),
        filter(() => this.isSlidingVia$.value === 'keyboard'),
        tap(() => this.isSlidingVia$.next(null)),
      )
      .subscribe();

    fromEvent(this._elementRef.nativeElement, 'blur')
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this._input._markAsTouched();
          this._input._setShouldDisplayError(true);
        }),
        take(1),
      )
      .subscribe();
  }

  private _initializeSlide(
    event: MouseEvent | TouchEvent,
    sliderDimensions: DOMRect,
    shouldInvertMouseCoords: boolean,
  ) {
    if (isTouchEvent(event)) {
      this.touchId$.next(getTouchIdForSlider(event, this._elementRef.nativeElement));
    }

    const pointerPosition = getPointerPositionOnPage(event, this.touchId$.value);

    if (!pointerPosition) {
      return;
    }

    this.isSlidingVia$.next('pointer');

    this._bindGlobalEvents(event);
    this._updateValueFromPosition(pointerPosition, sliderDimensions, shouldInvertMouseCoords);
    this._document.documentElement.style.cursor = 'grabbing';

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  private _bindGlobalEvents(event: MouseEvent | TouchEvent) {
    const isTouch = isTouchEvent(event);
    const moveEventName = isTouch ? 'touchmove' : 'mousemove';
    const endEventName = isTouch ? 'touchend' : 'mouseup';

    const eventConfig = { passive: false };

    const pointerUp$ = fromEvent<MouseEvent | TouchEvent>(window, endEventName, eventConfig);
    const touchCancel$ = fromEvent<TouchEvent>(window, 'touchcancel', eventConfig);
    const windowBlur$ = fromEvent<FocusEvent>(window, 'blur');

    const slideEnd$ = merge(pointerUp$, touchCancel$, windowBlur$);

    fromEvent<MouseEvent | TouchEvent>(window, moveEventName, eventConfig)
      .pipe(
        takeUntil(slideEnd$),
        takeUntil(this._destroy$),
        withLatestFrom(this._sliderDimensions$, this._shouldInvertMouseCoords$),
        tap(([event, sliderDimensions, shouldInvertMouseCoords]) => {
          const pointerPosition = getPointerPositionOnPage(event, this.touchId$.value);

          if (!pointerPosition) {
            return;
          }

          if (!this.disableAnimations$.value) {
            this.disableAnimations$.next(true);
          }

          this._updateValueFromPosition(pointerPosition, sliderDimensions, shouldInvertMouseCoords);
        }),
      )
      .subscribe();

    slideEnd$
      .pipe(
        takeUntil(this._destroy$),
        take(1),
        tap((event) => {
          event.preventDefault();
          this.isSlidingVia$.next(null);
          this.touchId$.next(null);
          this._document.documentElement.style.cursor = '';
          this.disableAnimations$.next(false);
        }),
      )
      .subscribe();
  }

  private _updateValueFromPosition = (
    pos: { x: number; y: number },
    sliderDimensions: DOMRect,
    shouldInvertMouseCoords: boolean,
  ) => {
    const offset = this.vertical ? sliderDimensions.top : sliderDimensions.left;
    const size = this.vertical ? sliderDimensions.height : sliderDimensions.width;
    const posComponent = this.vertical ? pos.y : pos.x;

    let percent = clamp((posComponent - offset) / size, 0, 1);

    if (shouldInvertMouseCoords) {
      percent = 1 - percent;
    }

    if (percent === 0) {
      this._input._updateValue(this.min);
    } else if (percent === 1) {
      this._input._updateValue(this.max);
    } else {
      const exactValue = percent * (this.max - this.min) + this.min;
      const closestValue = Math.round((exactValue - this.min) / this.step) * this.step + this.min;
      this._input._updateValue(clamp(closestValue, this.min, this.max));
    }

    this._input._markAsTouched();
    this._input._setShouldDisplayError(true);
  };

  private _updateSliderViaKeyboard(event: KeyboardEvent, dir: string) {
    switch (event.key) {
      case 'PageUp':
        this._updateSliderValueBy(10);
        break;
      case 'PageDown':
        this._updateSliderValueBy(-10);
        break;
      case 'End':
        this._input._updateValue(this.max);
        break;
      case 'Home':
        this._input._updateValue(this.min);
        break;
      case 'ArrowLeft':
        this._updateSliderValueBy(dir === 'rtl' ? 1 : -1);
        break;
      case 'ArrowUp':
        this._updateSliderValueBy(1);
        break;
      case 'ArrowRight':
        this._updateSliderValueBy(dir === 'rtl' ? -1 : 1);
        break;
      case 'ArrowDown':
        this._updateSliderValueBy(-1);
        break;
      default:
        return;
    }

    event.preventDefault();
    this.isSlidingVia$.next('keyboard');

    this._input._markAsTouched();
    this._input._setShouldDisplayError(true);
  }

  private async _updateSliderValueBy(offset: number) {
    const currentValue = this._input.value || 0;
    const value = clamp(currentValue + this.step * offset, this.min, this.max);

    this._input._updateValue(value);
  }

  private _freshSliderDimensions() {
    this._sliderDimensions$.next(this._elementRef.nativeElement.getBoundingClientRect());

    return this._sliderDimensions$;
  }
}
