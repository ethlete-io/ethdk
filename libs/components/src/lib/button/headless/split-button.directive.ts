import { Directive, afterNextRender, computed, signal } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
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
  private hostElement = injectHostElement();

  private actions = signal<SplitButtonActionDirective[]>([]);
  private triggers = signal<SplitButtonTriggerDirective[]>([]);

  /** The action segment of the group, or `null` while none is registered. */
  public registeredAction = computed(() => this.actions()[0] ?? null);

  /** The trigger segment of the group, or `null` while none is registered. */
  public registeredTrigger = computed(() => this.triggers()[0] ?? null);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredAction()) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.MISSING_ACTION,
            '[SplitButtonDirective] A required [etSplitButtonAction] element was not found. ' +
              'Add a button with the etSplitButtonAction directive.',
            { element: this.hostElement },
          );
        }

        if (this.actions().length > 1) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.DUPLICATE_ACTION,
            '[SplitButtonDirective] A split button groups exactly two segments, but ' +
              `${this.actions().length} [etSplitButtonAction] elements were found. Remove the extra ones.`,
            { element: this.hostElement },
          );
        }

        if (!this.registeredTrigger()) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.MISSING_TRIGGER,
            '[SplitButtonDirective] A required [etSplitButtonTrigger] element was not found. ' +
              'Add a button with the etSplitButtonTrigger directive.',
            { element: this.hostElement },
          );
        }

        if (this.triggers().length > 1) {
          throw new RuntimeError(
            SPLIT_BUTTON_ERROR_CODES.DUPLICATE_TRIGGER,
            '[SplitButtonDirective] A split button groups exactly two segments, but ' +
              `${this.triggers().length} [etSplitButtonTrigger] elements were found. Remove the extra ones.`,
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** @internal */
  public registerAction(action: SplitButtonActionDirective) {
    this.actions.update((actions) => [...actions, action]);
  }

  /** @internal */
  public unregisterAction(action: SplitButtonActionDirective) {
    this.actions.update((actions) => actions.filter((candidate) => candidate !== action));
  }

  /** @internal */
  public registerTrigger(trigger: SplitButtonTriggerDirective) {
    this.triggers.update((triggers) => [...triggers, trigger]);
  }

  /** @internal */
  public unregisterTrigger(trigger: SplitButtonTriggerDirective) {
    this.triggers.update((triggers) => triggers.filter((candidate) => candidate !== trigger));
  }
}
