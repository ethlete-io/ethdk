import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { InputDirective } from './headless';

@Component({
  selector: 'et-input',
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: InputDirective,
      inputs: [
        'type',
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
    class: 'et-input',
    '(click)': 'inputDir.activate()',
  },
})
export class InputComponent {
  protected inputDir = inject(InputDirective);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  constructor() {
    afterNextRender(() => {
      this.inputDir.focusTarget.set(this.nativeInput()?.nativeElement ?? null);
    });
  }

  public syncNativeValue(event: Event) {
    this.inputDir.value.set((event.target as HTMLInputElement).value);
  }
}
