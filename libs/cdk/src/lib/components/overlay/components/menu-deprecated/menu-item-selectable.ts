import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, Input } from '@angular/core';
import { CdkMenuItem } from './menu-item';

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  host: {
    '[attr.aria-checked]': '!!checked',
    '[attr.aria-disabled]': 'disabled || null',
  },
  standalone: false,
})
export abstract class CdkMenuItemSelectable extends CdkMenuItem {
  @Input('cdkMenuItemChecked')
  get checked(): boolean {
    return this._checked;
  }
  set checked(value: BooleanInput) {
    this._checked = coerceBooleanProperty(value);

    if (this._checked) {
      this.getParentMenu()?.focusItem(this);
    }
  }
  private _checked = false;

  protected override closeOnSpacebarTrigger = false;
}
