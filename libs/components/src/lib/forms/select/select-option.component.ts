import { Component, ViewEncapsulation } from '@angular/core';
import { CHECK_ICON, IconDirective, PLUS_ICON, provideIcons } from '../../icon';
import { SelectOptionDirective } from './headless';
import { mountSelectOptionStyles } from './select-option-styles.component';

@Component({
  selector: 'et-select-option',
  templateUrl: './select-option.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  // PLUS_ICON draws the "Create …" row; provideIcons hides every icon the parent registered
  providers: [provideIcons(CHECK_ICON, PLUS_ICON)],
  hostDirectives: [
    {
      directive: SelectOptionDirective,
      inputs: ['value', 'label', 'disabled', 'customValueOption'],
    },
  ],
  host: {
    class: 'et-select-option',
  },
})
export class SelectOptionComponent {
  constructor() {
    mountSelectOptionStyles();
  }
}
