import { DestroyRef, Directive, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { SPLIT_BUTTON_ERROR_CODES } from './split-button-errors';
import { SplitButtonDirective } from './split-button.directive';

@Directive({
  selector: '[etSplitButtonTrigger]',
  exportAs: 'etSplitButtonTrigger',
  host: {
    class: 'et-split-button-trigger',
  },
})
export class SplitButtonTriggerDirective {
  private splitButton = inject(SplitButtonDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement();

  constructor() {
    this.splitButton?.registerTrigger(this);

    this.destroyRef.onDestroy(() => {
      this.splitButton?.unregisterTrigger(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.splitButton) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.TRIGGER_OUTSIDE_SPLIT_BUTTON,
            '[SplitButtonTriggerDirective] etSplitButtonTrigger must be placed inside an [etSplitButton] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
