import { Directive, ElementRef, InjectionToken, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnimatedOverlayDirective, ClickObserverService } from '@ethlete/core';
import { THEME_PROVIDER } from '@ethlete/theming';
import { Subscription, filter, fromEvent, tap } from 'rxjs';
import { OverlayCloseBlockerDirective } from '../../../../directives/overlay-close-auto-blocker';
import { MenuComponent } from '../../components';

export const MENU_TRIGGER_TOKEN = new InjectionToken<MenuTriggerDirective>('MENU_TRIGGER_TOKEN');

@Directive({
  selector: '[etMenuTrigger]',
  standalone: true,
  providers: [
    {
      provide: MENU_TRIGGER_TOKEN,
      useExisting: MenuTriggerDirective,
    },
  ],
  hostDirectives: [AnimatedOverlayDirective, OverlayCloseBlockerDirective],
})
export class MenuTriggerDirective implements OnDestroy {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly _animatedOverlay = inject<AnimatedOverlayDirective<MenuComponent>>(AnimatedOverlayDirective);
  private readonly _themeProvider = inject(THEME_PROVIDER, { optional: true });
  private readonly _clickObserverService = inject(ClickObserverService);

  protected readonly isOpen = signal<boolean>(false);

  private readonly _listenerSubscriptions: Subscription[] = [];

  constructor() {
    this._animatedOverlay.autoHide = true;
    this._animatedOverlay.shift = false;
    this._animatedOverlay.placement = 'bottom-start';
    this._animatedOverlay.autoResize = true;
    this._animatedOverlay.fallbackPlacements = ['bottom-start', 'bottom-end', 'top-start', 'top-end'];

    fromEvent<MouseEvent>(this._elementRef.nativeElement, 'click')
      .pipe(
        tap(() => this.mount()),
        takeUntilDestroyed(),
      )
      .subscribe();

    this._animatedOverlay
      .afterClosed()
      .pipe(
        tap(() => this._removeListeners()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._animatedOverlay._destroy();
    this._removeListeners();
  }

  mount() {
    if (!this._animatedOverlay.canMount) return;

    const menuRef = this._animatedOverlay.mount({
      component: MenuComponent,
      themeProvider: this._themeProvider,
      providers: [],
    });

    if (menuRef) {
      this.isOpen.set(true);
      this._addListeners();
    }
  }

  unmount() {
    if (!this._animatedOverlay.canUnmount) return;

    this._animatedOverlay.unmount();
    this.isOpen.set(false);
  }

  private _addListeners() {
    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(
        filter((e) => e.key === 'Escape'),
        tap(() => this.unmount()),
      )
      .subscribe();

    const clickOutsideSub = this._clickObserverService
      .observe(this._animatedOverlay.componentRef?.location.nativeElement)
      .subscribe((e) => {
        const targetElement = e.target as HTMLElement;
        const isInside = this._animatedOverlay.componentRef?.location.nativeElement.contains(targetElement);

        if (!isInside) {
          this.unmount();
        }
      });

    this._listenerSubscriptions.push(keyupEscSub, clickOutsideSub);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }
}
