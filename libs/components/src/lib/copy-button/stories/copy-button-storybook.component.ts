import { Component, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { CHECK_ICON, CLIPBOARD_CHECK_ICON, ICON_IMPORTS, provideIcons } from '../../icon';
import { COPY_BUTTON_IMPORTS } from '../copy-button.imports';

@Component({
  selector: 'et-sb-copy-button',
  template: `
    <div class="flex flex-wrap items-center gap-16 p-8 font-sans">
      <button #iconCopy="etCopyButton" [text]="text()" et-icon-button etCopyButton type="button">
        @if (iconCopy.copied()) {
          <i etIcon="et-check"></i>
        } @else {
          <i etIcon="et-clipboard-check"></i>
        }
      </button>

      <button #textCopy="etCopyButton" [text]="text()" et-text-button etCopyButton type="button">
        {{ textCopy.copied() ? 'Copied!' : 'Copy' }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...COPY_BUTTON_IMPORTS, ...ICON_IMPORTS, ...BUTTON_IMPORTS],
  providers: [provideIcons(CHECK_ICON, CLIPBOARD_CHECK_ICON)],
})
export class CopyButtonStorybookComponent {
  public text = input('npm install @ethlete/components');
}
