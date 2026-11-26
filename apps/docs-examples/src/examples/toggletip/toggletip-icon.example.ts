import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, CIRCLE_INFO_ICON, ICON_IMPORTS, TOGGLETIP_IMPORTS, provideIcons } from '@ethlete/components';

@Component({
  selector: 'app-toggletip-icon-example',
  template: `
    <div class="app-example-row">
      <span>Nomination closes at kick-off</span>

      <button
        aria-label="About nomination rules"
        etToggletip="You can change your nomination until the first match of the matchday starts."
        et-icon-button
        etToggletipTrigger
        size="sm"
        type="button"
        variant="transparent"
      >
        <i etIcon="et-circle-info"></i>
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, TOGGLETIP_IMPORTS],
  providers: [provideIcons(CIRCLE_INFO_ICON)],
})
export class ToggletipIconExampleComponent {}
