import { Component, ViewEncapsulation, inject } from '@angular/core';
import { IconDirective, TIMES_ICON, provideIcons } from '../icon';
import { ChipDirective, ChipRemoveDirective } from './headless';

@Component({
  selector: 'et-chip',
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ChipRemoveDirective, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [
    {
      directive: ChipDirective,
      inputs: ['disabled', 'removable'],
      outputs: ['remove'],
    },
  ],
  host: {
    class: 'et-chip',
  },
})
export class ChipComponent {
  protected chip = inject(ChipDirective);
}
