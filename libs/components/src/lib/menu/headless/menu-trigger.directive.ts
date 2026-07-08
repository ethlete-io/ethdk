import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuItemDirective } from './menu-item.directive';
import { MenuDirective } from './menu.directive';

@Directive({
  selector: '[etMenuTrigger]',
  exportAs: 'etMenuTrigger',
  host: {
    'aria-haspopup': 'menu',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.aria-controls]': 'controls()',
    '[attr.data-menu-open]': 'isOpen() || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MenuTriggerDirective {
  /** @internal The menu this trigger opens - for submenu trigger items, that is the submenu. */
  public menu = inject(MenuDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** @internal The same-element menu item this trigger is combined with, if any. Set by the item. */
  public hostItem: MenuItemDirective | null = null;

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-menu-trigger');
    }

    this.menu?.registeredTrigger.set(this);

    this.destroyRef.onDestroy(() => {
      this.menu?.unregisterTrigger(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menu) {
          throw new RuntimeError(
            MENU_ERROR_CODES.TRIGGER_OUTSIDE_MENU,
            '[MenuTriggerDirective] etMenuTrigger must be placed inside an [etMenu] element.',
          );
        }
      });
    }
  }

  /** @internal */
  public setHostItem(item: MenuItemDirective) {
    this.hostItem = item;
  }

  public isOpen() {
    return this.menu?.open() ?? false;
  }

  protected expanded() {
    return this.menu?.open() ?? null;
  }

  protected controls() {
    if (!this.menu?.open()) {
      return null;
    }

    return this.menu.registeredPanel()?.elementRef.nativeElement.id ?? null;
  }

  protected handleClick() {
    this.menu?.toggle('click');
  }

  protected handleKeydown(event: KeyboardEvent) {
    const menu = this.menu;

    // submenu trigger items are driven by the menu's central keyboard handling
    if (!menu || this.hostItem) {
      return;
    }

    if (menu.open()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        menu.closeAll('escape');
      }

      return;
    }

    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown': {
        event.preventDefault();
        menu.show('keyboard');

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        menu.show('keyboard', 'last');

        return;
      }
    }
  }
}
