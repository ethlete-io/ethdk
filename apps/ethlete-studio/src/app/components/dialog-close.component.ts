import { Component, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, ICON_IMPORTS, OverlayCloseDirective, provideIcons, TIMES_ICON } from '@ethlete/components';

@Component({
  selector: 'ethlete-dialog-close',
  template: `
    <button [aria-label]="label()" et-icon-button etOverlayClose type="button" variant="transparent" size="sm">
      <i etIcon="et-times"></i>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, OverlayCloseDirective],
  providers: [provideIcons(TIMES_ICON)],
  host: { class: 'contents' },
})
export class DialogCloseComponent {
  public label = input.required<string>();
}
