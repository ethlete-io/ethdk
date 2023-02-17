/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChangeDetectorRef, Directive, ElementRef, forwardRef, InjectionToken, NgZone } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { SliderThumb } from '../../types';
import { SliderThumbDirective } from '../slider-thumb/slider-thumb.directive';

export const SLIDER_RANGE_THUMB_TOKEN = new InjectionToken<SliderRangeThumbDirective>('ET_SLIDER_RANGE_THUMB');

export const SLIDER_RANGE_THUMB_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => SliderRangeThumbDirective),
  multi: true,
};

@Directive({
  selector: 'input[etSliderStartThumb], input[etSliderEndThumb]',
  exportAs: 'etSliderRangeThumb',
  providers: [
    SLIDER_RANGE_THUMB_VALUE_ACCESSOR,
    { provide: SLIDER_RANGE_THUMB_TOKEN, useExisting: SliderRangeThumbDirective },
  ],
  standalone: true,
})
export class SliderRangeThumbDirective extends SliderThumbDirective {
  private _sibling: SliderRangeThumbDirective | undefined;

  _isLeftThumb = false;
  _isEndThumb = false;

  constructor(_ngZone: NgZone, _elementRef: ElementRef<HTMLInputElement>, override readonly _cdr: ChangeDetectorRef) {
    super(_ngZone, _elementRef, _cdr);
    this._isEndThumb = this._hostElement.hasAttribute('etSliderEndThumb');
    this._setIsLeftThumb();
    this.thumbPosition = this._isEndThumb ? SliderThumb.END : SliderThumb.START;
  }

  getSibling(): SliderRangeThumbDirective | undefined {
    if (!this._sibling) {
      this._sibling = this._slider._getInput(this._isEndThumb ? SliderThumb.START : SliderThumb.END) as
        | SliderRangeThumbDirective
        | undefined;
    }
    return this._sibling;
  }

  getMinPos(): number {
    const sibling = this.getSibling();
    if (!this._isLeftThumb && sibling) {
      return sibling.translateX;
    }
    return 0;
  }

  getMaxPos(): number {
    const sibling = this.getSibling();
    if (this._isLeftThumb && sibling) {
      return sibling.translateX;
    }
    return this._slider._cachedWidth;
  }

  _setIsLeftThumb(): void {
    this._isLeftThumb = (this._isEndThumb && this._slider._isRtl) || (!this._isEndThumb && !this._slider._isRtl);
  }

  override _getDefaultValue(): number {
    return this._isEndThumb && this._slider._isRange ? this.max : this.min;
  }

  override _onInput(): void {
    super._onInput();
    this._updateSibling();
    if (!this._isActive) {
      this._updateWidthInactive();
    }
  }

  override _onNgControlValueChange(): void {
    super._onNgControlValueChange();
    this.getSibling()?._updateMinMax();
  }

  override _onPointerDown(event: PointerEvent): void {
    if (this.disabled) {
      return;
    }
    if (this._sibling) {
      this._sibling._updateWidthActive();
      this._sibling._hostElement.classList.add('et-slider-input-no-pointer-events');
    }
    super._onPointerDown(event);
  }

  override _onPointerUp(): void {
    super._onPointerUp();
    if (this._sibling) {
      setTimeout(() => {
        this._sibling!._updateWidthInactive();
        this._sibling!._hostElement.classList.remove('et-slider-input-no-pointer-events');
      });
    }
  }

  override _onPointerMove(event: PointerEvent): void {
    super._onPointerMove(event);
    if (!this._slider.step && this._isActive) {
      this._updateSibling();
    }
  }

  override _fixValue(event: PointerEvent): void {
    super._fixValue(event);
    this._sibling?._updateMinMax();
  }

  override _clamp(v: number): number {
    return Math.max(Math.min(v, this.getMaxPos()), this.getMinPos());
  }

  _updateMinMax(): void {
    const sibling = this.getSibling();
    if (!sibling) {
      return;
    }
    if (this._isEndThumb) {
      this.min = Math.max(this._slider.min, sibling.value);
      this.max = this._slider.max;
    } else {
      this.min = this._slider.min;
      this.max = Math.min(this._slider.max, sibling.value);
    }
  }

  override _updateWidthActive(): void {
    const minWidth = this._slider._inputPadding * 2;
    const maxWidth = this._slider._cachedWidth + this._slider._inputPadding - minWidth;
    const percentage =
      this._slider.min < this._slider.max ? (this.max - this.min) / (this._slider.max - this._slider.min) : 1;
    const width = maxWidth * percentage + minWidth;
    this._hostElement.style.width = `${width}px`;
    this._hostElement.style.padding = `0 ${this._slider._inputPadding}px`;
  }

  override _updateWidthInactive(): void {
    const sibling = this.getSibling();
    if (!sibling) {
      return;
    }
    const maxWidth = this._slider._cachedWidth;
    const midValue = this._isEndThumb
      ? this.value - (this.value - sibling.value) / 2
      : this.value + (sibling.value - this.value) / 2;

    const _percentage = this._isEndThumb
      ? (this.max - midValue) / (this._slider.max - this._slider.min)
      : (midValue - this.min) / (this._slider.max - this._slider.min);

    const percentage = this._slider.min < this._slider.max ? _percentage : 1;

    const width = maxWidth * percentage + 24;
    this._hostElement.style.width = `${width}px`;
    this._hostElement.style.padding = '0px';

    if (this._isLeftThumb) {
      this._hostElement.style.left = '-24px';
      this._hostElement.style.right = 'auto';
    } else {
      this._hostElement.style.left = 'auto';
      this._hostElement.style.right = '-24px';
    }
  }

  _updateStaticStyles(): void {
    this._hostElement.classList.toggle('et-slider__right-input', !this._isLeftThumb);
  }

  private _updateSibling(): void {
    const sibling = this.getSibling();
    if (!sibling) {
      return;
    }
    sibling._updateMinMax();
    if (this._isActive) {
      sibling._updateWidthActive();
    } else {
      sibling._updateWidthInactive();
    }
  }

  override writeValue(value: any): void {
    this.value = value;
    this._updateWidthInactive();
    this._updateSibling();
  }
}
