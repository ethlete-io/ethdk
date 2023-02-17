/* eslint-disable no-self-assign */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Directionality } from '@angular/cdk/bidi';
import { BooleanInput, coerceBooleanProperty, coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { Platform } from '@angular/cdk/platform';
import { NgForOf, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ContentChildren,
  ElementRef,
  forwardRef,
  InjectionToken,
  Input,
  NgZone,
  OnDestroy,
  Optional,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription, take } from 'rxjs';
import { SliderThumbComponent } from '../../..';
import {
  SliderRangeThumbDirective,
  SliderThumbDirective,
  SLIDER_RANGE_THUMB_TOKEN,
  SLIDER_THUMB_TOKEN,
} from '../../directives';
import { SliderThumb, SliderTickMark } from '../../types';

export const SLIDER_TOKEN = new InjectionToken<SliderComponent>('ET_SLIDER');

@Component({
  selector: 'et-slider',
  templateUrl: './slider.component.html',
  styleUrls: ['./slider.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slider',
  },
  imports: [NgIf, NgForOf, forwardRef(() => SliderThumbComponent)],
  hostDirectives: [],
  providers: [{ provide: SLIDER_TOKEN, useExisting: SliderComponent }],
})
export class SliderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('trackActive')
  _trackActive?: ElementRef<HTMLElement>;

  @ViewChildren(forwardRef(() => SliderThumbComponent))
  _thumbs?: QueryList<SliderThumbComponent>;

  @ContentChild(forwardRef(() => SLIDER_THUMB_TOKEN))
  _input?: SliderThumbDirective;

  @ContentChildren(forwardRef(() => SLIDER_RANGE_THUMB_TOKEN), { descendants: false })
  _inputs?: QueryList<SliderRangeThumbDirective>;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(v: BooleanInput) {
    this._disabled = coerceBooleanProperty(v);
    const endInput = this._getInput(SliderThumb.END);
    const startInput = this._getInput(SliderThumb.START);

    if (endInput) {
      endInput.disabled = this._disabled;
    }
    if (startInput) {
      startInput.disabled = this._disabled;
    }
  }
  private _disabled = false;

  @Input()
  get discrete(): boolean {
    return this._discrete;
  }
  set discrete(v: BooleanInput) {
    this._discrete = coerceBooleanProperty(v);
    this._updateValueIndicatorUIs();
  }
  private _discrete = false;

  @Input()
  get showTickMarks(): boolean {
    return this._showTickMarks;
  }
  set showTickMarks(v: BooleanInput) {
    this._showTickMarks = coerceBooleanProperty(v);
  }
  private _showTickMarks = false;

  @Input()
  get min(): number {
    return this._min;
  }
  set min(v: NumberInput) {
    const min = coerceNumberProperty(v, this._min);
    if (this._min !== min) {
      this._updateMin(min);
    }
  }
  private _min = 0;

  private _dirChangeSubscription: Subscription;

  private _resizeObserver: ResizeObserver | null = null;

  protected startValueIndicatorText = '';
  protected endValueIndicatorText = '';
  private _hasViewInitialized = false;
  private _resizeTimer: null | ReturnType<typeof setTimeout> = null;

  _tickMarkTrackWidth = 0;
  _knobRadius = 8;
  _inputPadding = 0;
  _inputOffset = 0;
  _endThumbTransform: string | null = null;
  _startThumbTransform: string | null = null;

  _isRange = false;
  _isRtl = false;
  _cachedWidth = 0;
  _cachedLeft = 0;
  _tickMarks: SliderTickMark[] = [];

  @Input()
  get max(): number {
    return this._max;
  }
  set max(v: NumberInput) {
    const max = coerceNumberProperty(v, this._max);
    if (this._max !== max) {
      this._updateMax(max);
    }
  }
  private _max = 100;

  @Input()
  get step(): number {
    return this._step;
  }
  set step(v: NumberInput) {
    const step = coerceNumberProperty(v, this._step);
    if (this._step !== step) {
      this._updateStep(step);
    }
  }
  private _step = 0;

  private _thumbsOverlap = false;

  @Input()
  displayWith: (value: number) => string = (value: number) => `${value}`;

  constructor(
    readonly _ngZone: NgZone,
    readonly _cdr: ChangeDetectorRef,
    readonly _platform: Platform,
    private _elementRef: ElementRef<HTMLElement>,
    @Optional() readonly _dir: Directionality,
  ) {
    this._dirChangeSubscription = this._dir.change.subscribe(() => this._onDirChange());
    this._isRtl = this._dir.value === 'rtl';
  }

  ngAfterViewInit(): void {
    if (this._platform.isBrowser) {
      this._updateDimensions();
    }

    const eInput = this._getInput(SliderThumb.END);
    const sInput = this._getInput(SliderThumb.START);
    this._isRange = !!eInput && !!sInput;
    this._cdr.detectChanges();

    this._inputPadding = this._knobRadius;
    this._inputOffset = this._knobRadius;

    this._isRange
      ? this._initUIRange(eInput as SliderRangeThumbDirective, sInput as SliderRangeThumbDirective)
      : this._initUINonRange(eInput!);

    this._updateTrackUI(eInput!);
    this._updateTickMarkUI();
    this._updateTickMarkTrackUI();

    this._observeHostResize();
    this._cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this._dirChangeSubscription.unsubscribe();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  private _updateMin(min: number): void {
    const prevMin = this._min;
    this._min = min;
    this._isRange ? this._updateMinRange({ old: prevMin, new: min }) : this._updateMinNonRange(min);
    this._onMinMaxOrStepChange();
  }

  private _updateMinRange(min: { old: number; new: number }): void {
    const endInput = this._getInput(SliderThumb.END) as SliderRangeThumbDirective;
    const startInput = this._getInput(SliderThumb.START) as SliderRangeThumbDirective;

    const oldEndValue = endInput.value;
    const oldStartValue = startInput.value;

    startInput.min = min.new;
    endInput.min = Math.max(min.new, startInput.value);
    startInput.max = Math.min(endInput.max, endInput.value);

    startInput._updateWidthInactive();
    endInput._updateWidthInactive();

    min.new < min.old
      ? this._onTranslateXChangeBySideEffect(endInput, startInput)
      : this._onTranslateXChangeBySideEffect(startInput, endInput);

    if (oldEndValue !== endInput.value) {
      this._onValueChange(endInput);
    }

    if (oldStartValue !== startInput.value) {
      this._onValueChange(startInput);
    }
  }

  private _updateMinNonRange(min: number): void {
    const input = this._getInput(SliderThumb.END) as SliderThumbDirective;
    if (input) {
      const oldValue = input.value;

      input.min = min;
      input._updateThumbUIByValue();
      this._updateTrackUI(input);

      if (oldValue !== input.value) {
        this._onValueChange(input);
      }
    }
  }

  private _updateMax(max: number): void {
    const prevMax = this._max;
    this._max = max;
    this._isRange ? this._updateMaxRange({ old: prevMax, new: max }) : this._updateMaxNonRange(max);
    this._onMinMaxOrStepChange();
  }

  private _updateMaxRange(max: { old: number; new: number }): void {
    const endInput = this._getInput(SliderThumb.END) as SliderRangeThumbDirective;
    const startInput = this._getInput(SliderThumb.START) as SliderRangeThumbDirective;

    const oldEndValue = endInput.value;
    const oldStartValue = startInput.value;

    endInput.max = max.new;
    startInput.max = Math.min(max.new, endInput.value);
    endInput.min = startInput.value;

    endInput._updateWidthInactive();
    startInput._updateWidthInactive();

    max.new > max.old
      ? this._onTranslateXChangeBySideEffect(startInput, endInput)
      : this._onTranslateXChangeBySideEffect(endInput, startInput);

    if (oldEndValue !== endInput.value) {
      this._onValueChange(endInput);
    }

    if (oldStartValue !== startInput.value) {
      this._onValueChange(startInput);
    }
  }

  private _updateMaxNonRange(max: number): void {
    const input = this._getInput(SliderThumb.END);
    if (input) {
      const oldValue = input.value;

      input.max = max;
      input._updateThumbUIByValue();
      this._updateTrackUI(input);

      if (oldValue !== input.value) {
        this._onValueChange(input);
      }
    }
  }

  private _updateStep(step: number): void {
    this._step = step;
    this._isRange ? this._updateStepRange() : this._updateStepNonRange();
    this._onMinMaxOrStepChange();
  }

  private _updateStepRange(): void {
    const endInput = this._getInput(SliderThumb.END) as SliderRangeThumbDirective;
    const startInput = this._getInput(SliderThumb.START) as SliderRangeThumbDirective;

    const oldEndValue = endInput.value;
    const oldStartValue = startInput.value;

    const prevStartValue = startInput.value;

    endInput.min = this._min;
    startInput.max = this._max;

    endInput.step = this._step;
    startInput.step = this._step;

    if (this._platform.SAFARI) {
      endInput.value = endInput.value;
      startInput.value = startInput.value;
    }

    endInput.min = Math.max(this._min, startInput.value);
    startInput.max = Math.min(this._max, endInput.value);

    startInput._updateWidthInactive();
    endInput._updateWidthInactive();

    endInput.value < prevStartValue
      ? this._onTranslateXChangeBySideEffect(startInput, endInput)
      : this._onTranslateXChangeBySideEffect(endInput, startInput);

    if (oldEndValue !== endInput.value) {
      this._onValueChange(endInput);
    }

    if (oldStartValue !== startInput.value) {
      this._onValueChange(startInput);
    }
  }

  private _updateStepNonRange(): void {
    const input = this._getInput(SliderThumb.END);
    if (input) {
      const oldValue = input.value;

      input.step = this._step;
      if (this._platform.SAFARI) {
        input.value = input.value;
      }

      input._updateThumbUIByValue();

      if (oldValue !== input.value) {
        this._onValueChange(input);
      }
    }
  }

  private _initUINonRange(eInput: SliderThumbDirective): void {
    eInput.initProps();
    eInput.initUI();

    this._updateValueIndicatorUI(eInput);

    this._hasViewInitialized = true;
    eInput._updateThumbUIByValue();
  }

  private _initUIRange(eInput: SliderRangeThumbDirective, sInput: SliderRangeThumbDirective): void {
    eInput.initProps();
    eInput.initUI();

    sInput.initProps();
    sInput.initUI();

    eInput._updateMinMax();
    sInput._updateMinMax();

    eInput._updateStaticStyles();
    sInput._updateStaticStyles();

    this._updateValueIndicatorUIs();

    this._hasViewInitialized = true;

    eInput._updateThumbUIByValue();
    sInput._updateThumbUIByValue();
  }

  private _onDirChange(): void {
    this._isRtl = this._dir.value === 'rtl';
    this._isRange ? this._onDirChangeRange() : this._onDirChangeNonRange();
    this._updateTickMarkUI();
  }

  private _onDirChangeRange(): void {
    const endInput = this._getInput(SliderThumb.END) as SliderRangeThumbDirective;
    const startInput = this._getInput(SliderThumb.START) as SliderRangeThumbDirective;

    endInput._setIsLeftThumb();
    startInput._setIsLeftThumb();

    endInput.translateX = endInput._calcTranslateXByValue();
    startInput.translateX = startInput._calcTranslateXByValue();

    endInput._updateStaticStyles();
    startInput._updateStaticStyles();

    endInput._updateWidthInactive();
    startInput._updateWidthInactive();

    endInput._updateThumbUIByValue();
    startInput._updateThumbUIByValue();
  }

  private _onDirChangeNonRange(): void {
    const input = this._getInput(SliderThumb.END)!;
    input._updateThumbUIByValue();
  }

  private _observeHostResize() {
    if (typeof ResizeObserver === 'undefined' || !ResizeObserver) {
      return;
    }

    this._ngZone.runOutsideAngular(() => {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._isActive()) {
          return;
        }
        if (this._resizeTimer) {
          clearTimeout(this._resizeTimer);
        }
        this._onResize();
      });
      this._resizeObserver.observe(this._elementRef.nativeElement);
    });
  }

  private _isActive(): boolean {
    return this._getThumb(SliderThumb.START)._isActive || this._getThumb(SliderThumb.END)._isActive;
  }

  private _getValue(thumbPosition: SliderThumb = SliderThumb.END): number {
    const input = this._getInput(thumbPosition);
    if (!input) {
      return this.min;
    }
    return input.value;
  }

  private _skipUpdate(): boolean {
    return !!(this._getInput(SliderThumb.START)?._skipUIUpdate || this._getInput(SliderThumb.END)?._skipUIUpdate);
  }

  _updateDimensions(): void {
    this._cachedWidth = this._elementRef.nativeElement.offsetWidth;
    this._cachedLeft = this._elementRef.nativeElement.getBoundingClientRect().left;
  }

  _setTrackActiveStyles(styles: { left: string; right: string; transform: string; transformOrigin: string }): void {
    if (!this._trackActive) {
      return;
    }

    const trackStyle = this._trackActive.nativeElement.style;
    const animationOriginChanged = styles.left !== trackStyle.left && styles.right !== trackStyle.right;

    trackStyle.left = styles.left;
    trackStyle.right = styles.right;
    trackStyle.transformOrigin = styles.transformOrigin;

    if (animationOriginChanged) {
      this._elementRef.nativeElement.classList.add('et-slider-disable-track-animation');
      this._ngZone.onStable.pipe(take(1)).subscribe(() => {
        this._elementRef.nativeElement.classList.remove('et-slider-disable-track-animation');
        trackStyle.transform = styles.transform;
      });
    } else {
      trackStyle.transform = styles.transform;
    }
  }

  _calcTickMarkTransform(index: number): string {
    const translateX = index * (this._tickMarkTrackWidth / (this._tickMarks.length - 1));
    return `translateX(${translateX}px`;
  }

  _onTranslateXChange(source: SliderThumbDirective): void {
    if (!this._hasViewInitialized) {
      return;
    }

    this._updateThumbUI(source);
    this._updateTrackUI(source);
    this._updateOverlappingThumbUI(source as SliderRangeThumbDirective);
  }

  _onTranslateXChangeBySideEffect(input1: SliderRangeThumbDirective, input2: SliderRangeThumbDirective): void {
    if (!this._hasViewInitialized) {
      return;
    }

    input1._updateThumbUIByValue();
    input2._updateThumbUIByValue();
  }

  _onValueChange(source: SliderThumbDirective): void {
    if (!this._hasViewInitialized) {
      return;
    }

    this._updateValueIndicatorUI(source);
    this._updateTickMarkUI();
    this._cdr.detectChanges();
  }

  _onMinMaxOrStepChange(): void {
    if (!this._hasViewInitialized) {
      return;
    }

    this._updateTickMarkUI();
    this._updateTickMarkTrackUI();
    this._cdr.markForCheck();
  }

  _onResize(): void {
    if (!this._hasViewInitialized) {
      return;
    }

    this._updateDimensions();
    if (this._isRange) {
      const eInput = this._getInput(SliderThumb.END) as SliderRangeThumbDirective;
      const sInput = this._getInput(SliderThumb.START) as SliderRangeThumbDirective;

      eInput._updateThumbUIByValue();
      sInput._updateThumbUIByValue();

      eInput._updateStaticStyles();
      sInput._updateStaticStyles();

      eInput._updateMinMax();
      sInput._updateMinMax();

      eInput._updateWidthInactive();
      sInput._updateWidthInactive();
    } else {
      const eInput = this._getInput(SliderThumb.END);
      if (eInput) {
        eInput._updateThumbUIByValue();
      }
    }

    this._updateTickMarkUI();
    this._updateTickMarkTrackUI();
    this._cdr.detectChanges();
  }

  private _areThumbsOverlapping(): boolean {
    const startInput = this._getInput(SliderThumb.START);
    const endInput = this._getInput(SliderThumb.END);
    if (!startInput || !endInput) {
      return false;
    }
    return endInput.translateX - startInput.translateX < 20;
  }

  private _updateOverlappingThumbClassNames(source: SliderRangeThumbDirective): void {
    const sibling = source.getSibling()!;
    const sourceThumb = this._getThumb(source.thumbPosition);
    const siblingThumb = this._getThumb(sibling.thumbPosition);
    siblingThumb._hostElement.classList.remove('et-slider__thumb--top');
    sourceThumb._hostElement.classList.toggle('et-slider__thumb--top', this._thumbsOverlap);
  }

  private _updateOverlappingThumbUI(source: SliderRangeThumbDirective): void {
    if (!this._isRange || this._skipUpdate()) {
      return;
    }
    if (this._thumbsOverlap !== this._areThumbsOverlapping()) {
      this._thumbsOverlap = !this._thumbsOverlap;
      this._updateOverlappingThumbClassNames(source);
    }
  }

  _updateThumbUI(source: SliderThumbDirective) {
    if (this._skipUpdate()) {
      return;
    }
    const thumb = this._getThumb(source.thumbPosition === SliderThumb.END ? SliderThumb.END : SliderThumb.START)!;
    thumb._hostElement.style.transform = `translateX(${source.translateX}px)`;
  }

  _updateValueIndicatorUI(source: SliderThumbDirective): void {
    if (this._skipUpdate()) {
      return;
    }

    const valuetext = this.displayWith(source.value);

    this._hasViewInitialized
      ? (source._valuetext = valuetext)
      : source._hostElement.setAttribute('aria-valuetext', valuetext);

    if (this.discrete) {
      source.thumbPosition === SliderThumb.START
        ? (this.startValueIndicatorText = valuetext)
        : (this.endValueIndicatorText = valuetext);

      const visualThumb = this._getThumb(source.thumbPosition);
      valuetext.length < 3
        ? visualThumb._hostElement.classList.add('et-slider__thumb--short-value')
        : visualThumb._hostElement.classList.remove('et-slider__thumb--short-value');
    }
  }

  private _updateValueIndicatorUIs(): void {
    const eInput = this._getInput(SliderThumb.END);
    const sInput = this._getInput(SliderThumb.START);

    if (eInput) {
      this._updateValueIndicatorUI(eInput);
    }
    if (sInput) {
      this._updateValueIndicatorUI(sInput);
    }
  }

  private _updateTickMarkTrackUI(): void {
    if (!this.showTickMarks || this._skipUpdate()) {
      return;
    }

    const step = this._step && this._step > 0 ? this._step : 1;
    const maxValue = Math.floor(this.max / step) * step;
    const percentage = (maxValue - this.min) / (this.max - this.min);
    this._tickMarkTrackWidth = this._cachedWidth * percentage - 6;
  }

  _updateTrackUI(source: SliderThumbDirective): void {
    if (this._skipUpdate()) {
      return;
    }

    this._isRange
      ? this._updateTrackUIRange(source as SliderRangeThumbDirective)
      : this._updateTrackUINonRange(source as SliderThumbDirective);
  }

  private _updateTrackUIRange(source: SliderRangeThumbDirective): void {
    const sibling = source.getSibling();
    if (!sibling || !this._cachedWidth) {
      return;
    }

    const activePercentage = Math.abs(sibling.translateX - source.translateX) / this._cachedWidth;

    if (source._isLeftThumb && this._cachedWidth) {
      this._setTrackActiveStyles({
        left: 'auto',
        right: `${this._cachedWidth - sibling.translateX}px`,
        transformOrigin: 'right',
        transform: `scaleX(${activePercentage})`,
      });
    } else {
      this._setTrackActiveStyles({
        left: `${sibling.translateX}px`,
        right: 'auto',
        transformOrigin: 'left',
        transform: `scaleX(${activePercentage})`,
      });
    }
  }

  private _updateTrackUINonRange(source: SliderThumbDirective): void {
    this._isRtl
      ? this._setTrackActiveStyles({
          left: 'auto',
          right: '0px',
          transformOrigin: 'right',
          transform: `scaleX(${1 - source.fillPercentage})`,
        })
      : this._setTrackActiveStyles({
          left: '0px',
          right: 'auto',
          transformOrigin: 'left',
          transform: `scaleX(${source.fillPercentage})`,
        });
  }

  _updateTickMarkUI(): void {
    if (!this.showTickMarks || this.step === undefined || this.min === undefined || this.max === undefined) {
      return;
    }
    const step = this.step > 0 ? this.step : 1;
    this._isRange ? this._updateTickMarkUIRange(step) : this._updateTickMarkUINonRange(step);

    if (this._isRtl) {
      this._tickMarks.reverse();
    }
  }

  private _updateTickMarkUINonRange(step: number): void {
    const value = this._getValue();
    let numActive = Math.max(Math.round((value - this.min) / step), 0);
    let numInactive = Math.max(Math.round((this.max - value) / step), 0);
    this._isRtl ? numActive++ : numInactive++;

    this._tickMarks = Array(numActive)
      .fill(SliderTickMark.ACTIVE)
      .concat(Array(numInactive).fill(SliderTickMark.INACTIVE));
  }

  private _updateTickMarkUIRange(step: number): void {
    const endValue = this._getValue();
    const startValue = this._getValue(SliderThumb.START);
    const numInactiveBeforeStartThumb = Math.max(Math.floor((startValue - this.min) / step), 0);
    const numActive = Math.max(Math.floor((endValue - startValue) / step) + 1, 0);
    const numInactiveAfterEndThumb = Math.max(Math.floor((this.max - endValue) / step), 0);
    this._tickMarks = Array(numInactiveBeforeStartThumb)
      .fill(SliderTickMark.INACTIVE)
      .concat(
        Array(numActive).fill(SliderTickMark.ACTIVE),
        Array(numInactiveAfterEndThumb).fill(SliderTickMark.INACTIVE),
      );
  }

  _getInput(thumbPosition: SliderThumb): SliderThumbDirective | SliderRangeThumbDirective | undefined {
    if (thumbPosition === SliderThumb.END && this._input) {
      return this._input;
    }
    if (this._inputs?.length) {
      return thumbPosition === SliderThumb.START ? this._inputs.first : this._inputs.last;
    }
    return;
  }

  _getThumb(thumbPosition: SliderThumb): SliderThumbComponent {
    return (thumbPosition === SliderThumb.END ? this._thumbs?.last : this._thumbs?.first) as SliderThumbComponent;
  }

  _setTransition(withAnimation: boolean): void {
    this._elementRef.nativeElement.classList.toggle('et-slider-with-animation', withAnimation);
  }
}
