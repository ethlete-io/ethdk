import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DragGestureEvent, RuntimeError, dragGestureFrom } from '@ethlete/core';
import { tap } from 'rxjs';
import { COLOR_INPUT_ERROR_CODES } from '../color-input-errors';
import { COLOR_INPUT_TOKEN } from './color-input.directive';
import { hueToCssColor } from './internals/color-convert';
import { fractionFromPointer } from './internals/color-picker-engine';

/**
 * The two-dimensional saturation and brightness surface of a color picker: saturation along the
 * inline axis, brightness up the block axis. Owns the pointer drag; the keyboard path belongs to the
 * two range inputs the panel places inside it, which is also what makes the surface accessible.
 */
@Directive({
  selector: '[etColorPickerArea]',
  exportAs: 'etColorPickerArea',
  host: {
    class: 'et-color-picker-area',
    style: 'touch-action: none',
    '[style.--_et-color-picker-area-hue]': 'hueColor()',
    '(pointerdown)': 'handlePointerDown($event)',
  },
})
export class ColorPickerAreaDirective {
  private colorInput = inject(COLOR_INPUT_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** The fully saturated color at the current hue - the gradient's own corner stop. */
  public hueColor = computed(() => hueToCssColor(this.colorInput?.picker.hsv().hue ?? 0));

  public saturationPercent = computed(() => (this.colorInput?.picker.hsv().saturation ?? 0) * 100);

  public brightnessPercent = computed(() => (this.colorInput?.picker.hsv().value ?? 0) * 100);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.colorInput) {
          throw new RuntimeError(
            COLOR_INPUT_ERROR_CODES.AREA_OUTSIDE_COLOR_INPUT,
            '[ColorPickerAreaDirective] etColorPickerArea must be placed inside an [etColorInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected handlePointerDown(event: PointerEvent) {
    const colorInput = this.colorInput;

    if (!colorInput?.interactive() || event.button !== 0) {
      return;
    }

    this.commitFromPosition(event.clientX, event.clientY);

    // the surface follows the pointer from the first pixel, so there is no threshold below which
    // the press is still only a click
    event.preventDefault();

    dragGestureFrom(event, this.elementRef.nativeElement, { commitThreshold: 0 })
      .pipe(
        tap((gesture) => this.applyGesture(gesture)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private applyGesture(gesture: DragGestureEvent) {
    if (gesture.type === 'move' || gesture.type === 'end') {
      this.commitFromPosition(gesture.data.clientX, gesture.data.clientY);
    }
  }

  private commitFromPosition(clientX: number, clientY: number) {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const saturation = fractionFromPointer({ position: clientX, start: rect.left, size: rect.width });
    const brightness = 1 - fractionFromPointer({ position: clientY, start: rect.top, size: rect.height });

    this.colorInput?.picker.setSaturationAndValue(saturation, brightness);
  }
}
