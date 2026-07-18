import { Component, ViewEncapsulation } from '@angular/core';
import { CHECK_ICON, IconDirective, PLUS_ICON, provideIcons } from '../../icon';
import { SelectOptionDirective } from './headless';

@Component({
  selector: 'et-select-option',
  templateUrl: './select-option.component.html',
  styleUrl: './select-option.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  // PLUS is used by the "Create …" flavor of the option (`et-select`'s custom value row) —
  // provideIcons shadows the parent registry entirely, so the option must carry it itself
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
export class SelectOptionComponent {}
