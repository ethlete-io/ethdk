import { Component, ViewEncapsulation } from '@angular/core';
import { CHECK_ICON, IconDirective, provideIcons } from '../../icon';
import { SelectOptionDirective } from './headless';

@Component({
  selector: 'et-select-option',
  templateUrl: './select-option.component.html',
  styleUrl: './select-option.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHECK_ICON)],
  hostDirectives: [
    {
      directive: SelectOptionDirective,
      inputs: ['value', 'label', 'disabled'],
    },
  ],
  host: {
    class: 'et-select-option',
  },
})
export class SelectOptionComponent {}
