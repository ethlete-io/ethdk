import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, FILE_ICON, ICON_IMPORTS, provideIcons } from '@ethlete/components';

@Component({
  selector: 'app-empty-state-default-example',
  template: `
    <et-empty-state heading="No results" description="Try a different search term or clear your filters.">
      <i etIcon="et-file"></i>
      <button et-button etEmptyStateAction type="button">Clear filters</button>
    </et-empty-state>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [EMPTY_STATE_IMPORTS, ICON_IMPORTS, BUTTON_IMPORTS],
  providers: [provideIcons(FILE_ICON)],
})
export class EmptyStateDefaultExampleComponent {}
