import {
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  OnDestroy,
  TemplateRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnimatedOverlayDirective, ClickObserverService, signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { THEME_PROVIDER } from '@ethlete/theming';
import { Subscription, filter, fromEvent, take, tap } from 'rxjs';
import { OverlayCloseBlockerDirective } from '../../../../directives/overlay-close-auto-blocker';
import { MenuComponent } from '../../components/menu';
import { MENU_TEMPLATE, MenuContainerComponent } from '../../components/menu-container';

export const MENU_TRIGGER_TOKEN = new InjectionToken<MenuTriggerDirective>('ET_MENU_TRIGGER_TOKEN');

let uniqueId = 0;

@Directive({
  selector: '[etMenuTrigger]',
  standalone: true,
  providers: [
    {
      provide: MENU_TRIGGER_TOKEN,
      useExisting: MenuTriggerDirective,
    },
  ],
  hostDirectives: [
    { directive: AnimatedOverlayDirective, inputs: ['placement', 'offset', 'viewportPadding', 'fallbackPlacements'] },
    OverlayCloseBlockerDirective,
  ],
  host: {
    'aria-haspopup': 'menu',
    class: 'et-menu-trigger',
    '[id]': 'id',
  },
})
export class MenuTriggerDirective implements OnDestroy {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly _animatedOverlay = inject<AnimatedOverlayDirective<MenuContainerComponent>>(AnimatedOverlayDirective);
  private readonly _themeProvider = inject(THEME_PROVIDER, { optional: true });
  private readonly _clickObserverService = inject(ClickObserverService);

  readonly id = `et-menu-trigger-${uniqueId++}`;

  protected readonly isOpen = signal<boolean>(false);

  private readonly _listenerSubscriptions: Subscription[] = [];

  private readonly _currentMenu = signal<MenuComponent | null>(null);

  private readonly _currentMenuId = computed(() => {
    const menu = this._currentMenu();
    return menu ? menu.id() : null;
  });

  readonly currentMenu = this._currentMenu.asReadonly();

  @Input({ alias: 'etMenuTrigger', required: true })
  set __menuTemplate(value: TemplateRef<unknown>) {
    this.menuTemplate.set(value);
  }
  protected readonly menuTemplate = signal<TemplateRef<unknown> | null>(null);

  readonly hostClassBindings = signalHostClasses({
    'et-menu-trigger--open': this.isOpen,
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-controls': this._currentMenuId,
    'aria-expanded': this.isOpen,
  });

  constructor() {
    this._animatedOverlay.autoHide = true;
    this._animatedOverlay.shift = false;
    this._animatedOverlay.autoResize = true;

    if (!this._animatedOverlay.placement) {
      this._animatedOverlay.placement = 'bottom';
    }

    if (!this._animatedOverlay.fallbackPlacements) {
      this._animatedOverlay.fallbackPlacements = [
        'bottom',
        'bottom-start',
        'bottom-end',
        'top',
        'top-start',
        'top-end',
      ];
    }

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
    const menuTemplate = this.menuTemplate();

    if (!menuTemplate) {
      throw new Error('No menu template provided');
    }

    if (!this._animatedOverlay.canMount) return;

    const menuRef = this._animatedOverlay.mount({
      component: MenuContainerComponent,
      themeProvider: this._themeProvider,
      providers: [
        {
          provide: MENU_TEMPLATE,
          useValue: menuTemplate,
        },
      ],
    });

    if (menuRef) {
      this.isOpen.set(true);
      this._addListeners();
    }
  }

  unmount(restoreFocus = true) {
    if (!this._animatedOverlay.canUnmount) return;

    this._animatedOverlay.unmount();
    this.isOpen.set(false);

    if (restoreFocus) {
      this._animatedOverlay
        .afterClosed()
        .pipe(
          tap(() => this._elementRef.nativeElement.focus()),
          take(1),
        )
        .subscribe();
    }
  }

  _connectWithMenu(menu: MenuComponent) {
    this._currentMenu.set(menu);
  }

  _clearMenuConnection() {
    this._currentMenu.set(null);
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
