import { Directive, afterNextRender, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SplitButtonActionDirective } from './split-button-action.directive';
import { SPLIT_BUTTON_ERROR_CODES } from './split-button-errors';
import { SplitButtonTriggerDirective } from './split-button-trigger.directive';

@Directive({
  selector: '[etSplitButton]',
  exportAs: 'etSplitButton',
  host: {
    role: 'group',
  },
})
export class SplitButtonDirective {
  public registeredAction = signal<SplitButtonActionDirective | null>(null);
  public registeredTrigger = signal<SplitButtonTriggerDirective | null>(null);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredAction()) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.MISSING_ACTION,
            '[SplitButtonDirective] A required [etSplitButtonAction] element was not found. ' +
              'Add a button with the etSplitButtonAction directive.',
          );
        }

        if (!this.registeredTrigger()) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.MISSING_TRIGGER,
            '[SplitButtonDirective] A required [etSplitButtonTrigger] element was not found. ' +
              'Add a button with the etSplitButtonTrigger directive.',
          );
        }
      });
    }
  }

  /** @internal */
  public unregisterAction(action: SplitButtonActionDirective) {
    if (this.registeredAction() === action) {
      this.registeredAction.set(null);
    }
  }

  /** @internal */
  public unregisterTrigger(trigger: SplitButtonTriggerDirective) {
    if (this.registeredTrigger() === trigger) {
      this.registeredTrigger.set(null);
    }
  }
}
