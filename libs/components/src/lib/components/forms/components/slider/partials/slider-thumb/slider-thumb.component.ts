/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MAT_SLIDER, SliderComponent } from '../../components/slider/slider.component';
import { MatSliderThumbDirective } from '../../directives/slider-thumb/slider-thumb.directive';
import { _MatThumb } from '../../types';

@Component({
  selector: 'et-slider-thumb',
  templateUrl: './slider-thumb.component.html',
  styleUrls: ['./slider-thumb.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slider-thumb',
  },
  imports: [NgIf],
  hostDirectives: [],
})
export class SliderThumbComponent implements AfterViewInit, OnDestroy {
  /** Whether the slider displays a numeric value label upon pressing the thumb. */
  @Input()
  discrete = false;

  /** Indicates which slider thumb this input corresponds to. */
  @Input()
  thumbPosition!: _MatThumb;

  /** The display value of the slider thumb. */
  @Input()
  valueIndicatorText: string | null = null;

  /** The slider thumb knob. */
  @ViewChild('knob')
  _knob?: ElementRef<HTMLElement>;

  /** The slider thumb value indicator container. */
  @ViewChild('valueIndicatorContainer')
  _valueIndicatorContainer?: ElementRef<HTMLElement>;

  /** The slider input corresponding to this slider thumb. */
  private _sliderInput: MatSliderThumbDirective | null = null;

  /** The native html element of the slider input corresponding to this thumb. */
  private _sliderInputEl: HTMLInputElement | null = null;

  /** Whether the slider thumb is currently being hovered. */
  private _isHovered = false;

  /** Whether the slider thumb is currently being pressed. */
  _isActive = false;

  /** Whether the value indicator tooltip is visible. */
  _isValueIndicatorVisible = false;

  /** The host native HTML input element. */
  _hostElement: HTMLElement;

  constructor(
    readonly _cdr: ChangeDetectorRef,
    private readonly _ngZone: NgZone,
    _elementRef: ElementRef<HTMLElement>,
    @Inject(forwardRef(() => MAT_SLIDER)) private _slider: SliderComponent,
  ) {
    this._hostElement = _elementRef.nativeElement;
  }

  ngAfterViewInit() {
    this._sliderInput = this._slider._getInput(this.thumbPosition)!;
    this._sliderInputEl = this._sliderInput._hostElement;
    const input = this._sliderInputEl;

    // These listeners don't update any data bindings so we bind them outside
    // of the NgZone to prevent Angular from needlessly running change detection.
    this._ngZone.runOutsideAngular(() => {
      input.addEventListener('pointermove', this._onPointerMove);
      input.addEventListener('pointerdown', this._onDragStart);
      input.addEventListener('pointerup', this._onDragEnd);
      input.addEventListener('pointerleave', this._onMouseLeave);
      input.addEventListener('focus', this._onFocus);
      input.addEventListener('blur', this._onBlur);
    });
  }

  ngOnDestroy() {
    const input = this._sliderInputEl;

    if (!input) {
      return;
    }

    input.removeEventListener('pointermove', this._onPointerMove);
    input.removeEventListener('pointerdown', this._onDragStart);
    input.removeEventListener('pointerup', this._onDragEnd);
    input.removeEventListener('pointerleave', this._onMouseLeave);
    input.removeEventListener('focus', this._onFocus);
    input.removeEventListener('blur', this._onBlur);
  }

  private _onPointerMove = (event: PointerEvent): void => {
    if (this._sliderInput?._isFocused) {
      return;
    }

    const rect = this._hostElement.getBoundingClientRect();
    const isHovered = this._isSliderThumbHovered(event, rect);
    this._isHovered = isHovered;
  };

  private _onMouseLeave = (): void => {
    this._isHovered = false;
  };

  private _onFocus = (): void => {
    this._hostElement.classList.add('mdc-slider__thumb--focused');
  };

  private _onBlur = (): void => {
    this._hostElement.classList.remove('mdc-slider__thumb--focused');
  };

  private _onDragStart = (): void => {
    this._isActive = true;
  };

  private _onDragEnd = (): void => {
    this._isActive = false;
  };

  /** Shows the value indicator ui. */
  _showValueIndicator(): void {
    this._hostElement.classList.add('mdc-slider__thumb--with-indicator');
  }

  /** Hides the value indicator ui. */
  _hideValueIndicator(): void {
    this._hostElement.classList.remove('mdc-slider__thumb--with-indicator');
  }

  _getSibling(): SliderThumbComponent {
    return this._slider._getThumb(this.thumbPosition === _MatThumb.START ? _MatThumb.END : _MatThumb.START);
  }

  /** Gets the value indicator container's native HTML element. */
  _getValueIndicatorContainer(): HTMLElement | undefined {
    return this._valueIndicatorContainer?.nativeElement;
  }

  /** Gets the native HTML element of the slider thumb knob. */
  _getKnob() {
    return this._knob?.nativeElement || null;
  }

  private _isSliderThumbHovered(event: PointerEvent, rect: DOMRect) {
    const radius = rect.width / 2;
    const centerX = rect.x + radius;
    const centerY = rect.y + radius;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    return Math.pow(dx, 2) + Math.pow(dy, 2) < Math.pow(radius, 2);
  }
}
