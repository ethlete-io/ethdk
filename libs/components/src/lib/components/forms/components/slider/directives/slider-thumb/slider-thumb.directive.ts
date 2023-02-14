/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-empty-function */
import { BooleanInput, coerceBooleanProperty, coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  InjectionToken,
  Input,
  NgZone,
  OnDestroy,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { SliderComponent, SLIDER_TOKEN } from '../../components/slider/slider.component';
import { SliderThumb } from '../../types';

export const SLIDER_THUMB_TOKEN = new InjectionToken<SliderThumbDirective>('ET_SLIDER_THUMB');

export const SLIDER_THUMB_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SliderThumbDirective),
  multi: true,
};

@Directive({
  selector: 'input[etSliderThumb]',
  exportAs: 'etSliderThumb',
  host: {
    class: 'et-slider__input',
    type: 'range',
    '[attr.aria-valuetext]': '_valuetext',
    '(change)': '_onChange()',
    '(input)': '_onInput()',
    '(blur)': '_onBlur()',
    '(focus)': '_onFocus()',
  },
  providers: [SLIDER_THUMB_VALUE_ACCESSOR, { provide: SLIDER_THUMB_TOKEN, useExisting: SliderThumbDirective }],
  standalone: true,
})
export class SliderThumbDirective implements OnDestroy, ControlValueAccessor {
  protected _slider = inject<SliderComponent>(forwardRef(() => SLIDER_TOKEN));

  @Input()
  get value(): number {
    return coerceNumberProperty(this._hostElement.value);
  }
  set value(v: NumberInput) {
    const val = coerceNumberProperty(v).toString();
    if (!this._hasSetInitialValue) {
      this._initialValue = val;
      return;
    }
    if (this._isActive) {
      return;
    }
    this._hostElement.value = val;
    this._updateThumbUIByValue();
    this._slider._onValueChange(this);
    this._cdr.detectChanges();
  }

  @Output()
  readonly valueChange = new EventEmitter<number>();

  @Output()
  readonly dragStart = new EventEmitter<any>();

  @Output()
  readonly dragEnd = new EventEmitter<any>();

  get translateX(): number {
    if (this._slider.min >= this._slider.max) {
      this._translateX = 0;
      return this._translateX;
    }
    if (this._translateX === undefined) {
      this._translateX = this._calcTranslateXByValue();
    }
    return this._translateX;
  }
  set translateX(v: number) {
    this._translateX = v;
  }
  private _translateX: number | undefined;

  thumbPosition: SliderThumb = SliderThumb.END;

  get min(): number {
    return coerceNumberProperty(this._hostElement.min);
  }
  set min(v: NumberInput) {
    this._hostElement.min = coerceNumberProperty(v).toString();
    this._cdr.detectChanges();
  }

  get max(): number {
    return coerceNumberProperty(this._hostElement.max);
  }
  set max(v: NumberInput) {
    this._hostElement.max = coerceNumberProperty(v).toString();
    this._cdr.detectChanges();
  }

  get step(): number {
    return coerceNumberProperty(this._hostElement.step);
  }
  set step(v: NumberInput) {
    this._hostElement.step = coerceNumberProperty(v).toString();
    this._cdr.detectChanges();
  }

  get disabled(): boolean {
    return coerceBooleanProperty(this._hostElement.disabled);
  }
  set disabled(v: BooleanInput) {
    this._hostElement.disabled = coerceBooleanProperty(v);
    this._cdr.detectChanges();

    if (this._slider.disabled !== this.disabled) {
      this._slider.disabled = this.disabled;
    }
  }

  get percentage(): number {
    if (this._slider.min >= this._slider.max) {
      return this._slider._isRtl ? 1 : 0;
    }
    return (this.value - this._slider.min) / (this._slider.max - this._slider.min);
  }

  get fillPercentage(): number {
    if (!this._slider._cachedWidth) {
      return this._slider._isRtl ? 1 : 0;
    }
    if (this._translateX === 0) {
      return 0;
    }
    return this.translateX / this._slider._cachedWidth;
  }

  _hostElement: HTMLInputElement;
  _valuetext: string | undefined;
  _knobRadius = 8;
  _isActive = false;
  _isFocused = false;
  _initialValue: string | undefined;
  _skipUIUpdate = false;

  private _hasSetInitialValue = false;

  private _formControl: FormControl | undefined;

  protected readonly _destroyed = new Subject<void>();

  private _onChangeFn: (value: any) => void = () => {};
  private _onTouchedFn: () => void = () => {};

  constructor(
    readonly _ngZone: NgZone,
    readonly _elementRef: ElementRef<HTMLInputElement>,
    readonly _cdr: ChangeDetectorRef,
  ) {
    this._hostElement = _elementRef.nativeElement;
    this._ngZone.runOutsideAngular(() => {
      this._hostElement.addEventListener('pointerdown', this._onPointerDown.bind(this));
      this._hostElement.addEventListener('pointermove', this._onPointerMove.bind(this));
      this._hostElement.addEventListener('pointerup', this._onPointerUp.bind(this));
    });
  }

  ngOnDestroy(): void {
    this._hostElement.removeEventListener('pointerdown', this._onPointerDown);
    this._hostElement.removeEventListener('pointermove', this._onPointerMove);
    this._hostElement.removeEventListener('pointerup', this._onPointerUp);
    this._destroyed.next();
    this._destroyed.complete();
    this.dragStart.complete();
    this.dragEnd.complete();
  }

  private _setIsFocused(v: boolean): void {
    this._isFocused = v;
  }

  initProps(): void {
    this._updateWidthInactive();

    if (this.disabled !== this._slider.disabled) {
      this._slider.disabled = true;
    }

    this.step = this._slider.step;
    this.min = this._slider.min;
    this.max = this._slider.max;
    this._initValue();
  }

  initUI(): void {
    this._updateThumbUIByValue();
  }

  _initValue(): void {
    this._hasSetInitialValue = true;
    if (this._initialValue === undefined) {
      this.value = this._getDefaultValue();
    } else {
      this._hostElement.value = this._initialValue;
      this._updateThumbUIByValue();
      this._slider._onValueChange(this);
      this._cdr.detectChanges();
    }
  }

  _getDefaultValue(): number {
    return this.min;
  }

  _onBlur(): void {
    this._setIsFocused(false);
    this._onTouchedFn();
  }

  _onFocus(): void {
    this._setIsFocused(true);
  }

  _onChange(): void {
    if (this._isActive) {
      this._updateThumbUIByValue({ withAnimation: true });
    }
  }

  _onInput(): void {
    this.valueChange.emit(this.value);
    this._onChangeFn(this.value);
    if (this._slider.step || !this._isActive) {
      this._updateThumbUIByValue({ withAnimation: true });
    }
    this._slider._onValueChange(this);
  }

  _onNgControlValueChange(): void {
    if (!this._isActive || !this._isFocused) {
      this._slider._onValueChange(this);
      this._updateThumbUIByValue();
    }
    this._slider.disabled = this._formControl!.disabled;
  }

  _onPointerDown(event: PointerEvent): void {
    if (this.disabled || event.button !== 0) {
      return;
    }

    this._isActive = true;
    this._setIsFocused(true);
    this._updateWidthActive();
    this._slider._updateDimensions();

    if (!this._slider.step) {
      this._updateThumbUIByPointerEvent(event, { withAnimation: true });
    }

    if (!this.disabled) {
      this._handleValueCorrection(event);
      this.dragStart.emit({ source: this, parent: this._slider, value: this.value });
    }
  }

  private _handleValueCorrection(event: PointerEvent): void {
    this._skipUIUpdate = true;

    setTimeout(() => {
      this._skipUIUpdate = false;
      this._fixValue(event);
    }, 0);
  }

  _fixValue(event: PointerEvent): void {
    const xPos = event.clientX - this._slider._cachedLeft;
    const width = this._slider._cachedWidth;
    const step = this._slider.step === 0 ? 1 : this._slider.step;
    const numSteps = Math.floor((this._slider.max - this._slider.min) / step);
    const percentage = this._slider._isRtl ? 1 - xPos / width : xPos / width;

    const fixedPercentage = Math.round(percentage * numSteps) / numSteps;

    const impreciseValue = fixedPercentage * (this._slider.max - this._slider.min) + this._slider.min;
    const value = Math.round(impreciseValue / step) * step;
    const prevValue = this.value;

    if (value === prevValue) {
      this._slider._onValueChange(this);
      this._slider.step > 0
        ? this._updateThumbUIByValue()
        : this._updateThumbUIByPointerEvent(event, { withAnimation: true });
      return;
    }

    this.value = value;
    this.valueChange.emit(this.value);
    this._onChangeFn(this.value);
    this._slider._onValueChange(this);
    this._slider.step > 0
      ? this._updateThumbUIByValue()
      : this._updateThumbUIByPointerEvent(event, { withAnimation: true });
  }

  _onPointerMove(event: PointerEvent): void {
    if (!this._slider.step && this._isActive) {
      this._updateThumbUIByPointerEvent(event);
    }
  }

  _onPointerUp(): void {
    if (this._isActive) {
      this._isActive = false;
      this.dragEnd.emit({ source: this, parent: this._slider, value: this.value });
      setTimeout(() => this._updateWidthInactive());
    }
  }

  _clamp(v: number): number {
    return Math.max(Math.min(v, this._slider._cachedWidth), 0);
  }

  _calcTranslateXByValue(): number {
    if (this._slider._isRtl) {
      return (1 - this.percentage) * this._slider._cachedWidth;
    }
    return this.percentage * this._slider._cachedWidth;
  }

  _calcTranslateXByPointerEvent(event: PointerEvent): number {
    return event.clientX - this._slider._cachedLeft;
  }

  _updateWidthActive(): void {
    this._hostElement.style.padding = `0 ${this._slider._inputPadding}px`;
    this._hostElement.style.width = `calc(100% + ${this._slider._inputPadding}px)`;
  }

  _updateWidthInactive(): void {
    this._hostElement.style.padding = '0px';
    this._hostElement.style.width = 'calc(100% + 48px)';
    this._hostElement.style.left = '-24px';
  }

  _updateThumbUIByValue(options?: { withAnimation: boolean }): void {
    this.translateX = this._clamp(this._calcTranslateXByValue());
    this._updateThumbUI(options);
  }

  _updateThumbUIByPointerEvent(event: PointerEvent, options?: { withAnimation: boolean }): void {
    this.translateX = this._clamp(this._calcTranslateXByPointerEvent(event));
    this._updateThumbUI(options);
  }

  _updateThumbUI(options?: { withAnimation: boolean }) {
    this._slider._setTransition(!!options?.withAnimation);
    this._slider._onTranslateXChange(this);
  }

  writeValue(value: any): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  focus(): void {
    this._hostElement.focus();
  }

  blur(): void {
    this._hostElement.blur();
  }
}
