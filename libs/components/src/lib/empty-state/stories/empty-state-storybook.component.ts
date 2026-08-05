import { Component, input, ViewEncapsulation } from '@angular/core';
import { FILE_ICON, ICON_IMPORTS, provideIcons, RegisteredIconName, TRIANGLE_EXCLAMATION_ICON } from '../../icon';
import { BUTTON_IMPORTS } from '../../button';
import { EMPTY_STATE_IMPORTS } from '../empty-state.imports';

@Component({
  selector: 'et-sb-empty-state',
  template: `
    <div class="flex flex-wrap items-start gap-8 p-8 font-sans">
      <et-empty-state [heading]="heading()" [description]="description()">
        <i [etIcon]="icon()"></i>

        @if (showAction()) {
          <button et-button etEmptyStateAction type="button">Clear filters</button>
        }
      </et-empty-state>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...EMPTY_STATE_IMPORTS, ...ICON_IMPORTS, ...BUTTON_IMPORTS],
  providers: [provideIcons(FILE_ICON, TRIANGLE_EXCLAMATION_ICON)],
})
export class EmptyStateStorybookComponent {
  public heading = input('No results');
  public description = input('Try a different search term or clear your filters.');
  public icon = input<RegisteredIconName>('et-file');
  public showAction = input(true);
}
