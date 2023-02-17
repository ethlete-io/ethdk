/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { SliderComponent, SLIDER_TOKEN } from '../../components/slider/slider.component';
import { SliderThumbDirective } from '../../directives';
import { SliderThumb } from '../../types';

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
  private _slider = inject<SliderComponent>(forwardRef(() => SLIDER_TOKEN));

  @Input()
  discrete = false;

  @Input()
  thumbPosition!: SliderThumb;

  @Input()
  valueIndicatorText: string | null = null;

  @ViewChild('knob')
  _knob?: ElementRef<HTMLElement>;

  @ViewChild('valueIndicatorContainer')
  _valueIndicatorContainer?: ElementRef<HTMLElement>;

  private _sliderInput: SliderThumbDirective | null = null;
  private _sliderInputEl: HTMLInputElement | null = null;
  private _isHovered = false;

  _isActive = false;
  _isValueIndicatorVisible = false;
  _hostElement: HTMLElement;

  constructor(
    readonly _cdr: ChangeDetectorRef,
    private readonly _ngZone: NgZone,
    _elementRef: ElementRef<HTMLElement>,
  ) {
    this._hostElement = _elementRef.nativeElement;
  }

  ngAfterViewInit() {
    this._sliderInput = this._slider._getInput(this.thumbPosition)!;
    this._sliderInputEl = this._sliderInput._hostElement;
    const input = this._sliderInputEl;

    if (!input) {
      return;
    }

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
    this._hostElement.classList.add('et-slider__thumb--focused');
  };

  private _onBlur = (): void => {
    this._hostElement.classList.remove('et-slider__thumb--focused');
  };

  private _onDragStart = (): void => {
    this._isActive = true;
  };

  private _onDragEnd = (): void => {
    this._isActive = false;
  };

  _showValueIndicator(): void {
    this._hostElement.classList.add('et-slider__thumb--with-indicator');
  }

  _hideValueIndicator(): void {
    this._hostElement.classList.remove('et-slider__thumb--with-indicator');
  }

  _getSibling(): SliderThumbComponent {
    return this._slider._getThumb(this.thumbPosition === SliderThumb.START ? SliderThumb.END : SliderThumb.START);
  }

  _getValueIndicatorContainer(): HTMLElement | undefined {
    return this._valueIndicatorContainer?.nativeElement;
  }

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
