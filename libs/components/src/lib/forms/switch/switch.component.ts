import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { SwitchDirective } from './headless';

@Component({
  selector: 'et-switch',
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: SwitchDirective,
      inputs: ['checked', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-switch',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class SwitchComponent {
  public canAnimate = createCanAnimateSignal();
}
