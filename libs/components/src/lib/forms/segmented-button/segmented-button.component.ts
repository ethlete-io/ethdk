import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { SegmentedButtonDirective } from './headless';

@Component({
  selector: 'et-segmented-button',
  templateUrl: './segmented-button.component.html',
  styleUrl: './segmented-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: SegmentedButtonDirective,
      inputs: ['value', 'checked', 'disabled'],
      outputs: ['checkedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-segmented-button',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class SegmentedButtonComponent {
  public canAnimate = createCanAnimateSignal();
}
