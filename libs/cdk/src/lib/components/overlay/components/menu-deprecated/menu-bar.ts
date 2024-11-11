/* eslint-disable @angular-eslint/directive-class-suffix */

import { DOWN_ARROW, ESCAPE, LEFT_ARROW, RIGHT_ARROW, TAB, UP_ARROW, hasModifierKey } from '@angular/cdk/keycodes';
import { AfterContentInit, Directive } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { CdkMenuBase } from './menu-base';
import { CdkMenuGroup } from './menu-group';
import { CDK_MENU } from './menu-interface';
import { FocusNext, MENU_STACK, MenuStack } from './menu-stack';

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkMenuBar]',
  exportAs: 'cdkMenuBar',
  standalone: true,
  host: {
    role: 'menubar',
    class: 'cdk-menu-bar',
    '(keydown)': '_handleKeyEvent($event)',
  },
  providers: [
    { provide: CdkMenuGroup, useExisting: CdkMenuBar },
    { provide: CDK_MENU, useExisting: CdkMenuBar },
    { provide: MENU_STACK, useFactory: () => MenuStack.inline('horizontal') },
  ],
})
export class CdkMenuBar extends CdkMenuBase implements AfterContentInit {
  override readonly orientation = 'horizontal';

  override readonly isInline = true;

  override ngAfterContentInit() {
    super.ngAfterContentInit();
    this._subscribeToMenuStackEmptied();
  }

  _handleKeyEvent(event: KeyboardEvent) {
    const keyManager = this.keyManager;

    if (!keyManager) return;

    switch (event.keyCode) {
      case UP_ARROW:
      case DOWN_ARROW:
      case LEFT_ARROW:
      case RIGHT_ARROW:
        if (!hasModifierKey(event)) {
          const horizontalArrows = event.keyCode === LEFT_ARROW || event.keyCode === RIGHT_ARROW;

          if (horizontalArrows) {
            event.preventDefault();

            const prevIsOpen = keyManager.activeItem?.isMenuOpen();
            keyManager.activeItem?.getMenuTrigger()?.close();

            keyManager.setFocusOrigin('keyboard');
            keyManager.onKeydown(event);
            if (prevIsOpen) {
              keyManager.activeItem?.getMenuTrigger()?.open();
            }
          }
        }
        break;

      case ESCAPE:
        if (!hasModifierKey(event)) {
          event.preventDefault();
          keyManager.activeItem?.getMenuTrigger()?.close();
        }
        break;

      case TAB:
        if (!hasModifierKey(event, 'altKey', 'metaKey', 'ctrlKey')) {
          keyManager.activeItem?.getMenuTrigger()?.close();
        }
        break;

      default:
        keyManager.onKeydown(event);
    }
  }

  private _toggleOpenMenu(focusNext: FocusNext | undefined) {
    const keyManager = this.keyManager;

    if (!keyManager) return;

    switch (focusNext) {
      case FocusNext.nextItem:
        keyManager.setFocusOrigin('keyboard');
        keyManager.setNextItemActive();
        keyManager.activeItem?.getMenuTrigger()?.open();
        break;

      case FocusNext.previousItem:
        keyManager.setFocusOrigin('keyboard');
        keyManager.setPreviousItemActive();
        keyManager.activeItem?.getMenuTrigger()?.open();
        break;

      case FocusNext.currentItem:
        if (keyManager.activeItem) {
          keyManager.setFocusOrigin('keyboard');
          keyManager.setActiveItem(keyManager.activeItem);
        }
        break;
    }
  }

  private _subscribeToMenuStackEmptied() {
    this.menuStack?.emptied.pipe(takeUntil(this.destroyed)).subscribe((event) => this._toggleOpenMenu(event));
  }
}
