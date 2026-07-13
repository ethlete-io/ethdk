import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input, model } from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import { tap } from 'rxjs';
import { RuntimeError } from '@ethlete/core';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuItemActivationEvent, MenuItemDirective } from './menu-item.directive';
import {
  MENU_SELECTION_GROUP_TOKEN,
  MENU_SELECTION_ITEM_KIND,
  MenuSelectionItemKind,
} from './menu-selection-group.tokens';

@Directive({
  selector: '[etMenuSelectionItem]',
  exportAs: 'etMenuSelectionItem',
  host: {
    '[attr.aria-checked]': 'ariaChecked()',
    '(blur)': 'handleBlur()',
  },
})
export class MenuSelectionItemDirective {
  private group = inject(MENU_SELECTION_GROUP_TOKEN, { optional: true });
  private kindOverride = inject(MENU_SELECTION_ITEM_KIND, { optional: true });
  private menuItem = inject(MenuItemDirective, { self: true, optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public value = input<unknown>(undefined);
  public checked = model(false);
  public indeterminate = model(false);
  public touched = model(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public kind = computed<MenuSelectionItemKind>(() => {
    if (this.kindOverride) {
      return this.kindOverride;
    }

    if (this.group) {
      return this.group.multiple() ? 'checkbox' : 'radio';
    }

    return 'checkbox';
  });

  public ariaChecked = computed(() => {
    if (this.kind() === 'checkbox' && this.indeterminate()) {
      return 'mixed';
    }

    return this.checked();
  });

  private isDisabled = computed(() => this.disabled() || (this.group?.disabled() ?? false));

  constructor() {
    const menuItem = this.menuItem;

    if (menuItem) {
      menuItem.roleOverride.set(computed(() => (this.kind() === 'radio' ? 'menuitemradio' : 'menuitemcheckbox')));
      menuItem.setDefaultCloseOnActivate(false);
      menuItem.disabledOverride.set(this.isDisabled);

      outputToObservable(menuItem.activate)
        .pipe(
          takeUntilDestroyed(),
          tap((event) => this.handleActivation(event)),
        )
        .subscribe();
    }

    this.group?.registerItem(this);

    this.destroyRef.onDestroy(() => {
      this.group?.unregisterItem(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menuItem) {
          throw new RuntimeError(
            MENU_ERROR_CODES.ITEM_OUTSIDE_MENU,
            '[MenuSelectionItemDirective] etMenuSelectionItem must be combined with etMenuItem on the same element.',
          );
        }

        if (this.group && this.value() === undefined) {
          throw new RuntimeError(
            MENU_ERROR_CODES.SELECTION_ITEM_MISSING_VALUE,
            '[MenuSelectionItemDirective] Selection items inside a selection group require a value. Add a [value] input.',
          );
        }

        if (!this.group && this.kind() === 'radio') {
          throw new RuntimeError(
            MENU_ERROR_CODES.RADIO_ITEM_OUTSIDE_GROUP,
            '[MenuSelectionItemDirective] Radio items require a surrounding selection group. Wrap them in an et-menu-radio-group.',
          );
        }
      });
    }
  }

  public toggle() {
    if (this.isDisabled()) {
      return;
    }

    if (this.indeterminate()) {
      this.indeterminate.set(false);
      this.checked.set(true);

      return;
    }

    this.checked.update((checked) => !checked);
  }

  protected handleBlur() {
    if (this.group) {
      this.group.markTouched();
    } else {
      this.touched.set(true);
    }
  }

  private handleActivation(event: MenuItemActivationEvent) {
    if (this.group) {
      this.group.select(this);
    } else {
      this.toggle();
      this.touched.set(true);
    }

    // Enter picks and dismisses, Space and pointer clicks keep the menu open for further picks
    if (event.source === 'keyboard-enter') {
      this.menuItem?.owner?.closeAll('item');
    }
  }
}
