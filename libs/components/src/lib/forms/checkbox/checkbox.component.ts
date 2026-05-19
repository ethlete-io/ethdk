import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { CheckboxDirective } from './headless';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: CheckboxDirective,
      inputs: ['checked', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-checkbox',
  },
})
export class CheckboxComponent {}
