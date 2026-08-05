import { Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderDirective } from './cascader.directive';

/** The combobox trigger that opens the cascader panel. */
@Directive({
  selector: '[etCascaderTrigger]',
  exportAs: 'etCascaderTrigger',
  host: {
    role: 'combobox',
    'aria-haspopup': 'tree',
    '[attr.id]': 'id',
    '[attr.aria-expanded]': 'cascader?.open() || false',
    '[attr.aria-controls]': 'controlledId()',
    '[attr.aria-disabled]': 'cascader?.disabled() || null',
    '[attr.aria-required]': 'cascader?.required() || null',
    '[attr.aria-invalid]': 'cascader?.shouldDisplayError() || null',
    '[attr.aria-labelledby]': 'cascader?.labelId()',
    '[attr.aria-describedby]': 'cascader?.describedBy()',
    '[attr.tabindex]': 'isNativeButton ? null : cascader?.disabled() ? -1 : 0',
    '[attr.data-disabled]': 'cascader?.disabled() || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class CascaderTriggerDirective {
  public cascader = inject(CascaderDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly id: string;
  public readonly isNativeButton: boolean;

  // point at the tree panel's own stable id (the overlay runtime never ids the pane element, so
  // reading `paneElement.id` yielded an empty `aria-controls` the whole time the panel was open)
  protected controlledId = computed(() => (this.cascader?.open() ? this.cascader.panelId() : null));

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-cascader-trigger');
    }

    this.id = element.id;
    this.isNativeButton = element.tagName === 'BUTTON';

    registerSingleton(this.cascader?.registeredTrigger, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.TRIGGER_OUTSIDE_CASCADER,
            '[CascaderTriggerDirective] etCascaderTrigger must be placed inside an [etCascader] element.',
            { element },
          );
        }
      });
    }
  }

  protected handleClick() {
    this.cascader?.toggle();
  }

  protected handleFocus() {
    this.cascader?.triggerFocused.set(true);
  }

  protected handleBlur() {
    this.cascader?.triggerFocused.set(false);
    this.cascader?.touched.set(true);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const cascader = this.cascader;

    if (!cascader || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ': {
        if (!cascader.open()) {
          event.preventDefault();
          cascader.show();
        }

        return;
      }
      case 'Escape': {
        // handled by the overlay runtime while open
        return;
      }
    }
  }
}
