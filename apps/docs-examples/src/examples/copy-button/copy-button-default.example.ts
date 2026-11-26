import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  CHECK_ICON,
  CLIPBOARD_CHECK_ICON,
  COPY_BUTTON_IMPORTS,
  ICON_IMPORTS,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-copy-button-default-example',
  template: `
    <div class="app-example-row">
      <button
        #iconCopy="etCopyButton"
        [text]="COMMAND"
        aria-label="Copy the install command"
        et-icon-button
        etCopyButton
        type="button"
      >
        @if (iconCopy.copied()) {
          <i etIcon="et-check"></i>
        } @else {
          <i etIcon="et-clipboard-check"></i>
        }
      </button>

      <button #textCopy="etCopyButton" [text]="COMMAND" et-text-button etCopyButton type="button">
        {{ textCopy.copied() ? 'Copied!' : 'Copy' }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [COPY_BUTTON_IMPORTS, ICON_IMPORTS, BUTTON_IMPORTS],
  providers: [provideIcons(CHECK_ICON, CLIPBOARD_CHECK_ICON)],
})
export class CopyButtonDefaultExampleComponent {
  protected readonly COMMAND = 'yarn add @ethlete/components';
}
