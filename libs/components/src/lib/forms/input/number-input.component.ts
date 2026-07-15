import { afterNextRender, Component, ElementRef, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { NumberInputDirective } from './headless';

@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrl: './number-input.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: NumberInputDirective,
      inputs: [
        'min',
        'max',
        'step',
        'placeholder',
        'autocomplete',
        'textAlign',
        'value',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-number-input',
    '(click)': 'numberInputDir.activate()',
  },
})
export class NumberInputComponent {
  protected numberInputDir = inject(NumberInputDirective);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  constructor() {
    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.numberInputDir.focusTarget.set(nativeInput);
      this.numberInputDir.nativeControl.set(nativeInput);
    });
  }

  public syncNativeValue(event: Event) {
    this.numberInputDir.syncFromNativeInput(event.target as HTMLInputElement);
  }
}
