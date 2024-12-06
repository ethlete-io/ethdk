import { ConnectedPosition, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  Directive,
  EventEmitter,
  InjectionToken,
  Injector,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subject, merge } from 'rxjs';
import { Menu } from './menu-interface';
import { MENU_STACK, MenuStack } from './menu-stack';

export const MENU_TRIGGER = new InjectionToken<CdkMenuTriggerBase>('cdk-menu-trigger');

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  host: {
    '[attr.aria-controls]': 'childMenu?.id',
    '[attr.data-cdk-menu-stack-id]': 'menuStack.id',
  },
  standalone: false,
})
export abstract class CdkMenuTriggerBase implements OnDestroy {
  readonly injector = inject(Injector);

  protected readonly viewContainerRef = inject(ViewContainerRef);

  protected readonly menuStack: MenuStack = inject(MENU_STACK);

  menuPosition: ConnectedPosition[] | null = null;

  readonly opened: EventEmitter<void> = new EventEmitter();

  readonly closed: EventEmitter<void> = new EventEmitter();

  menuTemplateRef: TemplateRef<unknown> | null = null;

  menuData: unknown;

  protected overlayRef: OverlayRef | null = null;

  protected readonly destroyed: Subject<void> = new Subject();

  protected readonly stopOutsideClicksListener = merge(this.closed, this.destroyed);

  protected childMenu?: Menu;

  private _menuPortal: TemplatePortal | null = null;

  private _childMenuInjector?: Injector;

  ngOnDestroy() {
    this._destroyOverlay();

    this.destroyed.next();
    this.destroyed.complete();
  }

  isOpen() {
    return !!this.overlayRef?.hasAttached();
  }

  registerChildMenu(child: Menu) {
    this.childMenu = child;
  }

  protected getMenuContentPortal() {
    const hasMenuContentChanged = this.menuTemplateRef !== this._menuPortal?.templateRef;
    if (this.menuTemplateRef && (!this._menuPortal || hasMenuContentChanged)) {
      this._menuPortal = new TemplatePortal(
        this.menuTemplateRef,
        this.viewContainerRef,
        this.menuData,
        this._getChildMenuInjector(),
      );
    }

    return this._menuPortal;
  }

  protected isElementInsideMenuStack(element: Element) {
    for (let el: Element | null = element; el; el = el?.parentElement ?? null) {
      if (el.getAttribute('data-cdk-menu-stack-id') === this.menuStack.id) {
        return true;
      }
    }
    return false;
  }

  private _destroyOverlay() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  private _getChildMenuInjector() {
    this._childMenuInjector =
      this._childMenuInjector ||
      Injector.create({
        providers: [
          { provide: MENU_TRIGGER, useValue: this },
          { provide: MENU_STACK, useValue: this.menuStack },
        ],
        parent: this.injector,
      });
    return this._childMenuInjector;
  }
}
