import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

@Directive({
  selector: '[etColorInteractiveHasFocus]',
  host: {
    class: 'et-color-interactive et-color-interactive--has-focus',
  },
})
export class ColorInteractiveHasFocusDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
