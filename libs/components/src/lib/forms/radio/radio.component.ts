import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { RadioDirective } from './headless';

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrl: './radio.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: RadioDirective,
      inputs: ['value', 'checked', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-radio',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class RadioComponent {
  public radioDirective = inject(RadioDirective);

  public canAnimate = createCanAnimateSignal();
}
