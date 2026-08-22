import { Component, inject, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { SwitchDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';

@Component({
  selector: 'et-switch',
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: SwitchDirective,
      inputs: [
        'checked',
        'indeterminate',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['checkedChange', 'indeterminateChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-switch',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class SwitchComponent {
  private switchDir = inject(SwitchDirective);
  public canAnimate = createCanAnimateSignal();

  public focus(options?: FocusOptions) {
    this.switchDir.focus(options);
  }
}
