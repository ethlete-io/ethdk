import { DestroyRef, Directive, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { MENU_TRIGGER_ROOT_ALIGNMENT } from '../../menu/headless/menu-trigger.tokens';
import { SPLIT_BUTTON_ERROR_CODES } from './split-button-errors';
import { SplitButtonDirective } from './split-button.directive';

@Directive({
  selector: '[etSplitButtonTrigger]',
  exportAs: 'etSplitButtonTrigger',
  providers: [{ provide: MENU_TRIGGER_ROOT_ALIGNMENT, useValue: 'end' }],
  host: {
    class: 'et-split-button-trigger',
  },
})
export class SplitButtonTriggerDirective {
  private splitButton = inject(SplitButtonDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement();

  constructor() {
    if (ngDevMode && !this.splitButton) {
      throw new RuntimeError(
        SPLIT_BUTTON_ERROR_CODES.TRIGGER_OUTSIDE_SPLIT_BUTTON,
        '[SplitButtonTriggerDirective] etSplitButtonTrigger must be placed inside an [etSplitButton] element.',
        { element: this.hostElement },
      );
    }

    this.splitButton?.registerTrigger(this);

    this.destroyRef.onDestroy(() => {
      this.splitButton?.unregisterTrigger(this);
    });
  }
}
