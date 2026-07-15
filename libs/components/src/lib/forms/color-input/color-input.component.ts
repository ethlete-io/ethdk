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
      inputs: ['value', 'disabled', 'readonly', 'hidden', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'touchedChange'],
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
}
