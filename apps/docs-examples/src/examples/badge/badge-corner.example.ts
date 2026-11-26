import { Component, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, CIRCLE_INFO_ICON, ICON_IMPORTS, provideIcons } from '@ethlete/components';

@Component({
  selector: 'app-badge-corner-example',
  template: `
    <div class="app-example-row">
      <div class="app-badge-corner">
        <button aria-label="Filters, 3 active" et-icon-button type="button" variant="transparent">
          <i etIcon="et-circle-info"></i>
        </button>

        <et-badge class="app-badge-corner-badge" color="danger" size="sm" variant="filled">3</et-badge>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(CIRCLE_INFO_ICON)],
  styles: `
    .app-badge-corner {
      position: relative;
      display: inline-flex;
    }

    .app-badge-corner-badge {
      position: absolute;
      inset-block-start: 0;
      inset-inline-end: 0;
      translate: 30% -30%;
    }
  `,
})
export class BadgeCornerExampleComponent {}
