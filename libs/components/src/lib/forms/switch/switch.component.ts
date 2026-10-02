import { Component, inject, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { SwitchDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';

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
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['checkedChange', 'indeterminateChange', 'touchedChange', 'touch'],
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
