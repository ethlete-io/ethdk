import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject, untracked } from '@angular/core';
import { RuntimeError, setInputSignal } from '@ethlete/core';
import { BUTTON_VARIANTS } from '../../button/button.component';
import { ButtonDirective } from '../../button/headless';
import { TOGGLETIP_ERROR_CODES } from '../toggletip-errors';
import { ToggletipDirective } from './toggletip.directive';

const PRESSED_VARIANT_MAP: Record<string, string> = {
  [BUTTON_VARIANTS.FILLED]: 'outline',
  [BUTTON_VARIANTS.OUTLINE]: 'filled',
  [BUTTON_VARIANTS.TONAL]: 'filled',
  [BUTTON_VARIANTS.TRANSPARENT]: 'tonal',
};

@Directive({
  selector: '[etToggletipTrigger]',
  exportAs: 'etToggletipTrigger',
  host: {
    '[attr.data-pressed-variant]': 'pressedVariant()',
  },
})
export class ToggletipTriggerDirective {
  private button = inject(ButtonDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private toggletip = inject(ToggletipDirective, { optional: true });

  constructor() {
    const button = this.button;
    const toggletip = this.toggletip;

    if (button && toggletip) {
      effect(() => {
        const inactive = button.isInactive();

        untracked(() => {
          setInputSignal(toggletip.disabled, inactive);
        });
      });

      effect(() => {
        const open = toggletip.open();

        untracked(() => {
          setInputSignal(button.pressed, open);
          setInputSignal(button.emitAriaPressed, false);
        });
      });
    }

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.button) {
          throw new RuntimeError(
            TOGGLETIP_ERROR_CODES.TRIGGER_REQUIRES_BUTTON,
            '[ToggletipTriggerDirective] etToggletipTrigger must be used on an element that also has a button directive such as [et-button].',
          );
        }

        if (!this.toggletip) {
          throw new RuntimeError(
            TOGGLETIP_ERROR_CODES.TRIGGER_REQUIRES_TOGGLETIP,
            '[ToggletipTriggerDirective] etToggletipTrigger must be used on the same element as [etToggletip].',
          );
        }
      });
    }

    this.destroyRef.onDestroy(() => {
      if (!button || !toggletip) {
        return;
      }

      setInputSignal(toggletip.disabled, false);
      setInputSignal(button.pressed, false);
      setInputSignal(button.emitAriaPressed, true);
    });
  }

  isOpen() {
    return this.toggletip?.open() ?? false;
  }

  pressedVariant() {
    if (!this.isOpen()) {
      return null;
    }

    const variant = this.elementRef.nativeElement.getAttribute('data-variant');
    return variant ? (PRESSED_VARIANT_MAP[variant] ?? null) : null;
  }
}
