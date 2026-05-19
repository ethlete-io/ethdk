import { Directive, booleanAttribute, effect, input, signal } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { FocusRingStylesComponent } from './focus-ring-styles.component';

@Directive({
  selector: '[etFocusRing]',
  host: {
    '[class.et-focus-ring]': '!disabled()',
    '[class.et-focus-ring--active]': 'active()',
    '(keydown.enter)': 'active.set(true)',
    '(keyup.enter)': 'active.set(false)',
    '(keydown.space)': 'active.set(true)',
    '(keyup.space)': 'active.set(false)',
  },
})
export class FocusRingDirective {
  public disabled = input(false, { transform: booleanAttribute });

  private styleManager = injectStyleManager();

  protected active = signal(false);

  constructor() {
    effect(() => {
      if (this.disabled()) {
        return;
      }

      this.styleManager.mount(FocusRingStylesComponent);
    });
  }
}
