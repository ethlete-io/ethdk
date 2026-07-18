import { Component, ViewEncapsulation, inject } from '@angular/core';
import { DurationInputDirective, DurationInputFieldDirective } from './headless';

@Component({
  selector: 'et-duration-input',
  templateUrl: './duration-input.component.html',
  styleUrl: './duration-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DurationInputFieldDirective],
  hostDirectives: [
    {
      directive: DurationInputDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'durationFormat',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-duration-input',
    '(click)': 'durationInput.activate()',
  },
})
export class DurationInputComponent {
  protected durationInput = inject(DurationInputDirective);
}
