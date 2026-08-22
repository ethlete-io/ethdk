import { DestroyRef, Directive, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { SPLIT_BUTTON_ERROR_CODES } from './split-button-errors';
import { SplitButtonDirective } from './split-button.directive';

@Directive({
  selector: '[etSplitButtonAction]',
  exportAs: 'etSplitButtonAction',
  host: {
    class: 'et-split-button-action',
  },
})
export class SplitButtonActionDirective {
  private splitButton = inject(SplitButtonDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement();

  constructor() {
    this.splitButton?.registerAction(this);

    this.destroyRef.onDestroy(() => {
      this.splitButton?.unregisterAction(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.splitButton) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.ACTION_OUTSIDE_SPLIT_BUTTON,
            '[SplitButtonActionDirective] etSplitButtonAction must be placed inside an [etSplitButton] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
