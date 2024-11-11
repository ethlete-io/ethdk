/* eslint-disable @angular-eslint/directive-class-suffix */

import { ESCAPE, hasModifierKey, LEFT_ARROW, RIGHT_ARROW, TAB } from '@angular/cdk/keycodes';
import { AfterContentInit, Directive, EventEmitter, inject, OnDestroy, Output } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { CdkMenuBase } from './menu-base';
import { CdkMenuGroup } from './menu-group';
import { CDK_MENU } from './menu-interface';
import { FocusNext, PARENT_OR_NEW_INLINE_MENU_STACK_PROVIDER } from './menu-stack';
import { MENU_TRIGGER } from './menu-trigger-base';

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkMenu]',
  exportAs: 'cdkMenu',
  standalone: true,
  host: {
    role: 'menu',
    class: 'cdk-menu',
    '[class.cdk-menu-inline]': 'isInline',
    '(keydown)': '_handleKeyEvent($event)',
  },
  providers: [
    { provide: CdkMenuGroup, useExisting: CdkMenu },
    { provide: CDK_MENU, useExisting: CdkMenu },
    PARENT_OR_NEW_INLINE_MENU_STACK_PROVIDER('vertical'),
  ],
})
export class CdkMenu extends CdkMenuBase implements AfterContentInit, OnDestroy {
  private _parentTrigger = inject(MENU_TRIGGER, { optional: true });

  @Output() readonly closed: EventEmitter<void> = new EventEmitter();

  override readonly orientation = 'vertical';

  override readonly isInline = !this._parentTrigger;

  constructor() {
    super();
    this.destroyed.subscribe(this.closed);
    this._parentTrigger?.registerChildMenu(this);
  }

  override ngAfterContentInit() {
    super.ngAfterContentInit();
    this._subscribeToMenuStackEmptied();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.closed.complete();
  }

  _handleKeyEvent(event: KeyboardEvent) {
    const keyManager = this.keyManager;

    if (!keyManager) return;

    switch (event.keyCode) {
      case LEFT_ARROW:
      case RIGHT_ARROW:
        if (!hasModifierKey(event)) {
          event.preventDefault();
          keyManager.setFocusOrigin('keyboard');
          keyManager.onKeydown(event);
        }
        break;

      case ESCAPE:
        if (!hasModifierKey(event)) {
          event.preventDefault();
          this.menuStack.close(this, {
            focusNextOnEmpty: FocusNext.currentItem,
            focusParentTrigger: true,
          });
        }
        break;

      case TAB:
        if (!hasModifierKey(event, 'altKey', 'metaKey', 'ctrlKey')) {
          this.menuStack.closeAll({ focusParentTrigger: true });
        }
        break;

      default:
        keyManager.onKeydown(event);
    }
  }

  private _toggleMenuFocus(focusNext: FocusNext | undefined) {
    const keyManager = this.keyManager;

    if (!keyManager) return;

    switch (focusNext) {
      case FocusNext.nextItem:
        keyManager.setFocusOrigin('keyboard');
        keyManager.setNextItemActive();
        break;

      case FocusNext.previousItem:
        keyManager.setFocusOrigin('keyboard');
        keyManager.setPreviousItemActive();
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
    this.menuStack.emptied.pipe(takeUntil(this.destroyed)).subscribe((event) => this._toggleMenuFocus(event));
  }
}
