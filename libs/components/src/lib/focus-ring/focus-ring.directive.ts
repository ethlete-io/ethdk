import { Directive, booleanAttribute, effect, input, signal } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { FocusRingStylesComponent } from './focus-ring-styles.component';

@Directive({
  selector: '[etFocusRing]',
  host: {
    '[class.et-focus-ring]': '!focusRingDisabled()',
    '[class.et-focus-ring--active]': 'active()',
    '(keydown.enter)': 'active.set(true)',
    '(keyup.enter)': 'active.set(false)',
    '(keydown.space)': 'active.set(true)',
    '(keyup.space)': 'active.set(false)',
  },
})
export class FocusRingDirective {
  private styleManager = injectStyleManager();

  /**
   * Suppresses the ring on this element. Named for the directive, not `disabled`: on a native
   * control an input called `disabled` swallows the element's own `[disabled]` binding, leaving the
   * button enabled.
   */
  public focusRingDisabled = input(false, { transform: booleanAttribute });

  protected active = signal(false);

  constructor() {
    effect(() => {
      if (this.focusRingDisabled()) {
        return;
      }

      this.styleManager.mount(FocusRingStylesComponent);
    });
  }
}
