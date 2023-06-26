/* eslint-disable @angular-eslint/directive-class-suffix */
/* eslint-disable @angular-eslint/no-output-rename */
/* eslint-disable @angular-eslint/no-outputs-metadata-property */
/* eslint-disable @angular-eslint/no-input-rename */
/* eslint-disable @angular-eslint/no-inputs-metadata-property */

import { Directive } from '@angular/core';
import { CdkMenuItem } from './menu-item';
import { CdkMenuItemSelectable } from './menu-item-selectable';

@Directive({
  selector: '[cdkMenuItemCheckbox]',
  exportAs: 'cdkMenuItemCheckbox',
  standalone: true,
  host: {
    role: 'menuitemcheckbox',
    '[class.cdk-menu-item-checkbox]': 'true',
  },
  providers: [
    { provide: CdkMenuItemSelectable, useExisting: CdkMenuItemCheckbox },
    { provide: CdkMenuItem, useExisting: CdkMenuItemSelectable },
  ],
})
export class CdkMenuItemCheckbox extends CdkMenuItemSelectable {
  override trigger(options?: { keepOpen: boolean }) {
    super.trigger(options);

    if (!this.disabled) {
      this.checked = !this.checked;
    }
  }
}
