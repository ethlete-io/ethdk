 

import { FocusableOption, InputModalityDetector } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ENTER, LEFT_ARROW, RIGHT_ARROW, SPACE, hasModifierKey } from '@angular/cdk/keycodes';
import { Directive, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, inject } from '@angular/core';
import { Subject, fromEvent } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { MENU_AIM, Toggler } from './menu-aim';
import { CDK_MENU, Menu } from './menu-interface';
import { FocusNext, MENU_STACK } from './menu-stack';
import { CdkMenuTrigger } from './menu-trigger';
import { FocusableElement } from './pointer-focus-tracker';

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkMenuItem]',
  exportAs: 'cdkMenuItem',
  standalone: true,
  host: {
    role: 'menuitem',
    class: 'cdk-menu-item',
    '[tabindex]': '_tabindex',
    '[attr.aria-disabled]': 'disabled || null',
    '(blur)': '_resetTabIndex()',
    '(focus)': '_setTabIndex()',
    '(click)': '_handleClick()',
    '(mousedown)': '_handleMousedown($event)',
    '(keydown)': '_onKeydown($event)',
  },
})
export class CdkMenuItem implements FocusableOption, FocusableElement, Toggler, OnDestroy {
  protected readonly _dir = inject(Directionality, { optional: true });
  private readonly _inputModalityDetector = inject(InputModalityDetector);
  readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  protected _ngZone = inject(NgZone);

  private readonly _menuAim = inject(MENU_AIM, { optional: true });

  private readonly _menuStack = inject(MENU_STACK);

  private readonly _parentMenu = inject(CDK_MENU, { optional: true });

  private readonly _menuTrigger = inject(CdkMenuTrigger, { optional: true, self: true });

  @Input('cdkMenuItemDisabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @Input('cdkMenuitemTypeaheadLabel') typeaheadLabel: string | null = null;

  @Output('cdkMenuItemTriggered') readonly triggered: EventEmitter<void> = new EventEmitter();

  get hasMenu() {
    return this._menuTrigger?.menuTemplateRef != null;
  }

  _tabindex: 0 | -1 = -1;

  protected closeOnSpacebarTrigger = true;

  protected readonly destroyed = new Subject<void>();

  constructor() {
    this._setupMouseEnter();
    this._setType();

    if (this._isStandaloneItem()) {
      this._tabindex = 0;
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  focus() {
    this._elementRef.nativeElement.focus();
  }

  trigger(options?: { keepOpen: boolean }) {
    const { keepOpen } = { ...options };
    if (!this.disabled && !this.hasMenu) {
      this.triggered.next();
      if (!keepOpen) {
        this._menuStack.closeAll({ focusParentTrigger: true });
      }
    }
  }

  isMenuOpen() {
    return !!this._menuTrigger?.isOpen();
  }

  getMenu(): Menu | undefined {
    return this._menuTrigger?.getMenu();
  }

  getMenuTrigger(): CdkMenuTrigger | null {
    return this._menuTrigger;
  }

  getLabel(): string {
    return this.typeaheadLabel || this._elementRef.nativeElement.textContent?.trim() || '';
  }

  getParentMenu() {
    return this._parentMenu;
  }

  _resetTabIndex() {
    if (!this._isStandaloneItem()) {
      this._tabindex = -1;
    }
  }

  _setTabIndex(event?: MouseEvent) {
    if (this.disabled) {
      return;
    }

    if (!event || !this._menuStack.isEmpty()) {
      this._tabindex = 0;
    }
  }

  _onKeydown(event: KeyboardEvent) {
    switch (event.keyCode) {
      case SPACE:
      case ENTER:
        if (!hasModifierKey(event)) {
          this.trigger({ keepOpen: event.keyCode === SPACE && !this.closeOnSpacebarTrigger });
        }
        break;

      case RIGHT_ARROW:
        if (!hasModifierKey(event)) {
          if (this._parentMenu && this._isParentVertical()) {
            if (this._dir?.value !== 'rtl') {
              this._forwardArrowPressed(event);
            } else {
              this._backArrowPressed(event);
            }
          }
        }
        break;

      case LEFT_ARROW:
        if (!hasModifierKey(event)) {
          if (this._parentMenu && this._isParentVertical()) {
            if (this._dir?.value !== 'rtl') {
              this._backArrowPressed(event);
            } else {
              this._forwardArrowPressed(event);
            }
          }
        }
        break;
    }
  }

  _handleClick() {
    if (this._inputModalityDetector.mostRecentModality !== 'keyboard') {
      this.trigger();
    }
  }

  _handleMousedown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  private _isStandaloneItem() {
    return !this._parentMenu;
  }

  private _backArrowPressed(event: KeyboardEvent) {
    const parentMenu = this._parentMenu!;
    if (this._menuStack.hasInlineMenu() || this._menuStack.length() > 1) {
      event.preventDefault();
      this._menuStack.close(parentMenu, {
        focusNextOnEmpty:
          this._menuStack.inlineMenuOrientation() === 'horizontal' ? FocusNext.previousItem : FocusNext.currentItem,
        focusParentTrigger: true,
      });
    }
  }

  private _forwardArrowPressed(event: KeyboardEvent) {
    if (!this.hasMenu && this._menuStack.inlineMenuOrientation() === 'horizontal') {
      event.preventDefault();
      this._menuStack.closeAll({
        focusNextOnEmpty: FocusNext.nextItem,
        focusParentTrigger: true,
      });
    }
  }

  private _setupMouseEnter() {
    if (!this._isStandaloneItem()) {
      const closeOpenSiblings = () => this._ngZone.run(() => this._menuStack.closeSubMenuOf(this._parentMenu!));

      this._ngZone.runOutsideAngular(() =>
        fromEvent(this._elementRef.nativeElement, 'mouseenter')
          .pipe(
            filter(() => !this._menuStack.isEmpty() && !this.hasMenu),
            takeUntil(this.destroyed),
          )
          .subscribe(() => {
            if (this._menuAim) {
              this._menuAim.toggle(closeOpenSiblings);
            } else {
              closeOpenSiblings();
            }
          }),
      );
    }
  }

  private _isParentVertical() {
    return this._parentMenu?.orientation === 'vertical';
  }

  private _setType() {
    const element = this._elementRef.nativeElement;

    if (element.nodeName === 'BUTTON' && !element.getAttribute('type')) {
      element.setAttribute('type', 'button');
    }
  }
}
