import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { SelectionOptionDirective } from '../headless';

@Component({
  selector: 'et-segmented-button',
  template: '<ng-content />',
  styleUrl: './segmented-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: SelectionOptionDirective,
      inputs: ['value', 'checked', 'disabled'],
      outputs: ['checkedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-segmented-button',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class SegmentedButtonComponent {
  public optionDirective = inject(SelectionOptionDirective);

  public canAnimate = createCanAnimateSignal();
}
