import { Directive, ElementRef, afterNextRender, computed, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { COLOR_INPUT_ERROR_CODES } from '../color-input-errors';
import { COLOR_INPUT_TOKEN } from './color-input.directive';

export type ColorPickerChannel = 'saturation' | 'brightness' | 'hue' | 'alpha';

type ChannelConfig = {
  max: number;
  unit: string;
};

const CHANNEL_CONFIGS: Record<ColorPickerChannel, ChannelConfig> = {
  saturation: { max: 100, unit: '%' },
  brightness: { max: 100, unit: '%' },
  hue: { max: 360, unit: '°' },
  alpha: { max: 100, unit: '%' },
};

/**
 * Binds a native range input to one channel of the picker's color. The input carries the whole
 * keyboard and touch story - arrow keys, `Home`, `End`, page keys and the platform's own touch
 * handling - which is why every picker surface is built around one instead of a custom widget.
 *
 * Stretch the input over its track and hide it visually, and the same input becomes the track's
 * pointer handling too. The area is the exception: two channels cannot share one pointer, so its
 * inputs take no pointer events and `etColorPickerArea` drives the drag.
 */
@Directive({
  selector: 'input[etColorPickerChannel]',
  exportAs: 'etColorPickerChannel',
  host: {
    type: 'range',
    min: '0',
    step: '1',
    class: 'et-color-picker-channel',
    '[max]': 'config().max',
    '[value]': 'value()',
    '[disabled]': 'colorInput ? !colorInput.interactive() : false',
    '[attr.aria-valuetext]': 'valueText()',
    '(input)': 'commit($event)',
  },
})
export class ColorPickerChannelDirective {
  /** @internal */
  public colorInput = inject(COLOR_INPUT_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  public channel = input.required<ColorPickerChannel>({ alias: 'etColorPickerChannel' });

  protected config = computed(() => CHANNEL_CONFIGS[this.channel()]);

  protected value = computed(() => {
    const hsv = this.colorInput?.picker.hsv();

    if (!hsv) {
      return 0;
    }

    switch (this.channel()) {
      case 'saturation':
        return hsv.saturation * 100;
      case 'brightness':
        return hsv.value * 100;
      case 'hue':
        return hsv.hue;
      case 'alpha':
        return hsv.alpha * 100;
    }
  });

  protected valueText = computed(() => `${Math.round(this.value())}${this.config().unit}`);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.colorInput) {
          throw new RuntimeError(
            COLOR_INPUT_ERROR_CODES.TRACK_OUTSIDE_COLOR_INPUT,
            '[ColorPickerChannelDirective] etColorPickerChannel must be placed inside an [etColorInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected commit(event: Event) {
    const picker = this.colorInput?.picker;
    const hsv = this.colorInput?.picker.hsv();

    if (!picker || !hsv) {
      return;
    }

    const next = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(next)) {
      return;
    }

    switch (this.channel()) {
      case 'saturation':
        return picker.setSaturationAndValue(next / 100, hsv.value);
      case 'brightness':
        return picker.setSaturationAndValue(hsv.saturation, next / 100);
      case 'hue':
        return picker.setHue(next);
      case 'alpha':
        return picker.setAlpha(next / 100);
    }
  }
}
