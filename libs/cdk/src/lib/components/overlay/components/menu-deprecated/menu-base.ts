import { FocusKeyManager, FocusOrigin } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  AfterContentInit,
  ContentChildren,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  QueryList,
  inject,
} from '@angular/core';
import { Subject, merge } from 'rxjs';
import { mapTo, mergeAll, mergeMap, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { MENU_AIM } from './menu-aim';
import { CdkMenuGroup } from './menu-group';
import { Menu } from './menu-interface';
import { CdkMenuItem } from './menu-item';
import { MENU_STACK, MenuStack, MenuStackItem } from './menu-stack';
import { PointerFocusTracker } from './pointer-focus-tracker';

let nextId = 0;

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  host: {
    role: 'menu',
    class: '',
    '[tabindex]': '_getTabIndex()',
    '[id]': 'id',
    '[attr.aria-orientation]': 'orientation',
    '[attr.data-cdk-menu-stack-id]': 'menuStack.id',
    '(focus)': 'focusFirstItem()',
    '(focusin)': 'menuStack.setHasFocus(true)',
    '(focusout)': 'menuStack.setHasFocus(false)',
  },
})
export abstract class CdkMenuBase extends CdkMenuGroup implements Menu, AfterContentInit, OnDestroy {
  readonly nativeElement: HTMLElement = inject(ElementRef).nativeElement;

  protected ngZone = inject(NgZone);

  readonly menuStack: MenuStack = inject(MENU_STACK);

  protected readonly menuAim = inject(MENU_AIM, { optional: true, self: true });

  protected readonly dir = inject(Directionality, { optional: true });

  @Input() id = `cdk-menu-${nextId++}`;

  @ContentChildren(CdkMenuItem, { descendants: true })
  readonly items: QueryList<CdkMenuItem> | null = null;

  orientation: 'horizontal' | 'vertical' = 'vertical';

  isInline = false;

  protected keyManager: FocusKeyManager<CdkMenuItem> | null = null;

  protected readonly destroyed: Subject<void> = new Subject();

  protected triggerItem?: CdkMenuItem;

  protected pointerTracker?: PointerFocusTracker<CdkMenuItem>;

  private _menuStackHasFocus = false;

  ngAfterContentInit() {
    if (!this.isInline) {
      this.menuStack.push(this);
    }
    this._setKeyManager();
    this._subscribeToMenuStackHasFocus();
    this._subscribeToMenuOpen();
    this._subscribeToMenuStackClosed();
    this._setUpPointerTracker();
  }

  ngOnDestroy() {
    this.keyManager?.destroy();
    this.destroyed.next();
    this.destroyed.complete();
    this.pointerTracker?.destroy();
  }

  focusFirstItem(focusOrigin: FocusOrigin = 'program') {
    if (!this.keyManager) return;

    this.keyManager.setFocusOrigin(focusOrigin);
    this.keyManager.setFirstItemActive();
  }

  focusLastItem(focusOrigin: FocusOrigin = 'program') {
    if (!this.keyManager) return;

    this.keyManager.setFocusOrigin(focusOrigin);
    this.keyManager.setLastItemActive();
  }

  focusItem(item: CdkMenuItem, focusOrigin: FocusOrigin = 'program') {
    const doFocus = () => {
      if (!this.keyManager) return;

      const index = this.items?.toArray().indexOf(item);

      if (index !== undefined && index !== -1) {
        this.keyManager.setFocusOrigin(focusOrigin);
        this.keyManager.setActiveItem(index);
      }
    };

    if (!this.items) {
      setTimeout(() => {
        doFocus();
      }, 0);
    } else {
      doFocus();
    }
  }

  _getTabIndex() {
    const tabindexIfInline = this._menuStackHasFocus ? -1 : 0;
    return this.isInline ? tabindexIfInline : null;
  }

  protected closeOpenMenu(menu: MenuStackItem, options?: { focusParentTrigger?: boolean }) {
    const { focusParentTrigger } = { ...options };
    const keyManager = this.keyManager;
    const trigger = this.triggerItem;
    if (menu === trigger?.getMenuTrigger()?.getMenu()) {
      trigger?.getMenuTrigger()?.close();

      if (focusParentTrigger) {
        if (!keyManager) return;

        if (trigger) {
          keyManager.setActiveItem(trigger);
        } else {
          keyManager.setFirstItemActive();
        }
      }
    }
  }

  private _setKeyManager() {
    if (!this.items) return;

    this.keyManager = new FocusKeyManager(this.items).withWrap().withTypeAhead().withHomeAndEnd();

    if (this.orientation === 'horizontal') {
      this.keyManager.withHorizontalOrientation(this.dir?.value || 'ltr');
    } else {
      this.keyManager.withVerticalOrientation();
    }
  }

  private _subscribeToMenuOpen() {
    if (!this.items) return;

    const exitCondition = merge(this.items.changes, this.destroyed);
    this.items.changes
      .pipe(
        startWith(this.items),
        mergeMap((list: QueryList<CdkMenuItem>) =>
          list
            .filter((item) => item.hasMenu)
            .map((item) => item.getMenuTrigger()!.opened.pipe(mapTo(item), takeUntil(exitCondition))),
        ),
        mergeAll(),
        switchMap((item: CdkMenuItem) => {
          this.triggerItem = item;
          return item.getMenuTrigger()!.closed;
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(() => (this.triggerItem = undefined));
  }

  private _subscribeToMenuStackClosed() {
    this.menuStack.closed
      .pipe(takeUntil(this.destroyed))
      .subscribe(({ item, focusParentTrigger }) => this.closeOpenMenu(item, { focusParentTrigger }));
  }

  private _subscribeToMenuStackHasFocus() {
    if (this.isInline) {
      this.menuStack.hasFocus.pipe(takeUntil(this.destroyed)).subscribe((hasFocus) => {
        this._menuStackHasFocus = hasFocus;
      });
    }
  }

  private _setUpPointerTracker() {
    if (this.menuAim) {
      this.ngZone.runOutsideAngular(() => {
        if (!this.items) return;

        this.pointerTracker = new PointerFocusTracker(this.items);
      });
      this.menuAim.initialize(this, this.pointerTracker!);
    }
  }
}
