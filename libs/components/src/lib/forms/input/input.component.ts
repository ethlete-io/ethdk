import { afterNextRender, Component, ElementRef, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { InputDirective } from './headless';

@Component({
  selector: 'et-input',
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: InputDirective,
      inputs: [
        'type',
        'placeholder',
        'autocomplete',
        'textAlign',
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
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-input',
    '(click)': 'inputDir.activate()',
  },
})
export class InputComponent {
  protected inputDir = inject(InputDirective);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  constructor() {
    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.inputDir.focusTarget.set(nativeInput);
      this.inputDir.nativeControl.set(nativeInput);
    });
  }

  public syncNativeValue(event: Event) {
    this.inputDir.syncFromNativeInput(event.target as HTMLInputElement);
  }
}
