import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CHECK_ICON, IconDirective, provideIcons } from '../../icon';
import { SelectAllOptionDirective } from './headless';

/** The styled "Select all" row `et-select` renders for `selectAll`. Project the row's text. */
@Component({
  selector: 'et-select-all-option',
  template: `
    <span class="et-select-option-label">
      <ng-content />
    </span>

    <span class="et-select-option-check">
      @if (option.ariaChecked() === 'mixed') {
        <span class="et-select-all-option-dash" aria-hidden="true"></span>
      } @else {
        <i etIcon="et-check"></i>
      }
    </span>
  `,
  styleUrls: ['./select-option.component.css', './select-all-option.component.css'],
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHECK_ICON)],
  hostDirectives: [SelectAllOptionDirective],
  host: {
    class: 'et-select-option et-select-all-option',
  },
})
export class SelectAllOptionComponent {
  protected option = inject(SelectAllOptionDirective);
}
