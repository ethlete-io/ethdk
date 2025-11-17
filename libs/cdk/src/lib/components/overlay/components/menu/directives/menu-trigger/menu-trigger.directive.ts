import {
  DOCUMENT,
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
import {
  AnimatedOverlayDirective,
  THEME_PROVIDER,
  setInputSignal,
  signalHostAttributes,
  signalHostClasses,
} from '@ethlete/core';
import { Placement } from '@floating-ui/dom';
import { Subscription, filter, fromEvent, take, tap } from 'rxjs';
import { OverlayCloseBlockerDirective } from '../../../../directives/overlay-close-auto-blocker';
import { MenuComponent } from '../../components/menu';
import { MENU_TEMPLATE, MenuContainerComponent } from '../../components/menu-container';

export const MENU_TRIGGER_TOKEN = new InjectionToken<MenuTriggerDirective>('ET_MENU_TRIGGER_TOKEN');

let uniqueId = 0;

@Directive({
  selector: '[etMenuTrigger]',

  providers: [
    {
      provide: MENU_TRIGGER_TOKEN,
      useExisting: MenuTriggerDirective,
    },
  ],
  hostDirectives: [
    {
      directive: AnimatedOverlayDirective,
      inputs: [
        'placement',
        'offset',
        'shift',
        'viewportPadding',
        'fallbackPlacements',
        'referenceElement',
        'mirrorWidth',
      ],
    },
    OverlayCloseBlockerDirective,
  ],
  host: {
    'aria-haspopup': 'menu',
    class: 'et-menu-trigger',
    '[id]': 'id',
  },
})
export class MenuTriggerDirective implements OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly animatedOverlay = inject<AnimatedOverlayDirective<MenuContainerComponent>>(AnimatedOverlayDirective);
  private readonly themeProvider = inject(THEME_PROVIDER, { optional: true });
  private document = inject(DOCUMENT);

  readonly id = `et-menu-trigger-${uniqueId++}`;

  protected readonly isOpen = signal<boolean>(false);

  private readonly _listenerSubscriptions: Subscription[] = [];

  private readonly _currentMenu = signal<MenuComponent | null>(null);

  private readonly _currentMenuId = computed(() => {
    const menu = this._currentMenu();
    return menu ? menu.id() : null;
  });

  readonly currentMenu = this._currentMenu.asReadonly();

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
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
    setInputSignal(this.animatedOverlay.autoHide, true);
    setInputSignal(this.animatedOverlay.shift, false);
    setInputSignal(this.animatedOverlay.autoResize, true);

    if (!this.animatedOverlay.placement()) {
      setInputSignal(this.animatedOverlay.placement, 'bottom');
    }

    if (!this.animatedOverlay.fallbackPlacements()) {
      setInputSignal(this.animatedOverlay.fallbackPlacements, [
        'bottom',
        'bottom-start',
        'bottom-end',
        'top',
        'top-start',
        'top-end',
      ] satisfies Placement[]);
    }

    fromEvent<MouseEvent>(this.elementRef.nativeElement, 'click')
      .pipe(
        tap(() => this.mount()),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.animatedOverlay.afterClosed$
      .pipe(
        tap(() => this._removeListeners()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._removeListeners();
  }

  mount() {
    const menuTemplate = this.menuTemplate();

    if (!menuTemplate) {
      throw new Error('No menu template provided');
    }

    if (!this.animatedOverlay.canMount) return;

    const menuRef = this.animatedOverlay.mount({
      component: MenuContainerComponent,
      themeProvider: this.themeProvider,
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
    if (!this.animatedOverlay.canUnmount) return;

    this.animatedOverlay.unmount();
    this.isOpen.set(false);

    if (restoreFocus) {
      this.animatedOverlay.afterClosed$
        .pipe(
          tap(() => this.elementRef.nativeElement.focus()),
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
    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        filter((e) => e.key === 'Escape'),
        tap(() => {
          const menu = this.currentMenu();
          const searchInput = menu?.searchInput();

          if (!menu || !searchInput) {
            this.unmount();
            return;
          }

          if (searchInput.isFocusedVia) {
            if (searchInput.value) {
              return;
            }
          }

          this.unmount();
        }),
      )
      .subscribe();

    const clickOutsideSub = fromEvent<MouseEvent>(this.document.documentElement, 'click').subscribe((e) => {
      const targetElement = e.target as HTMLElement;
      const isInside = this.animatedOverlay.componentRef?.location.nativeElement.contains(targetElement);

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
