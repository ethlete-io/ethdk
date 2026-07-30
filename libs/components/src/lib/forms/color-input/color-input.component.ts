import { afterNextRender, Component, ElementRef, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { ColorInputDirective } from './headless';

@Component({
  selector: 'et-color-input',
  templateUrl: './color-input.component.html',
  styleUrl: './color-input.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ColorInputDirective,
      inputs: [
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
    class: 'et-color-input',
    '(click)': 'colorInputDir.activate()',
  },
})
export class ColorInputComponent {
  protected colorInputDir = inject(ColorInputDirective);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  constructor() {
    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.colorInputDir.focusTarget.set(nativeInput);
      this.colorInputDir.nativeControl.set(nativeInput);
    });
  }

  public syncNativeValue(event: Event) {
    this.colorInputDir.syncFromNativeInput(event.target as HTMLInputElement);
  }

  /**
   * `<input type="color">` ignores `readonly`, so we stop the events that open the OS picker
   * (pointer + Enter/Space) while the control is read-only — keeping it focusable but inert,
   * like every sibling control honors `readonly`.
   */
  protected blockWhenReadonly(event: Event) {
    if (this.colorInputDir.interactive()) {
      return;
    }

    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
  }
}
