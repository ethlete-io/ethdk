import { Directive } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { ButtonPropertiesStylesComponent } from './button-properties-styles.component';

@Directive({
  selector: '[etButtonStyles]',
})
export class ButtonStylesDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ButtonPropertiesStylesComponent);
  }
}
