import { Directive, booleanAttribute, effect, input } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { FocusRingStylesComponent } from './focus-ring-styles.component';

@Directive({
  selector: '[etFocusRing]',
  host: {
    '[class.et-focus-ring]': '!disabled()',
  },
})
export class FocusRingDirective {
  private styleManager = injectStyleManager();

  disabled = input(false, { transform: booleanAttribute });

  constructor() {
    effect(() => {
      if (this.disabled()) {
        return;
      }

      this.styleManager.mount(FocusRingStylesComponent);
    });
  }
}
