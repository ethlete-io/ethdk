import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { DescriptionComponent } from '../../description';
import { SelectionOptionDirective } from '../headless';

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrl: './radio.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DescriptionComponent],
  hostDirectives: [
    {
      directive: SelectionOptionDirective,
      inputs: ['value', 'checked', 'disabled'],
      outputs: ['checkedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-radio',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class RadioComponent {
  public optionDirective = inject(SelectionOptionDirective);

  public canAnimate = createCanAnimateSignal();
}
