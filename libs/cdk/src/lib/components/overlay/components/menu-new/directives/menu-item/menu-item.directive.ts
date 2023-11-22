import { ENTER, SPACE, hasModifierKey } from '@angular/cdk/keycodes';
import {
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  booleanAttribute,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { MENU_TRIGGER_TOKEN } from '../menu-trigger';

export const MENU_ITEM_TOKEN = new InjectionToken<MenuItemDirective>('MENU_ITEM_TOKEN');

@Directive({
  selector: '[etMenuItem]',
  standalone: true,
  providers: [
    {
      provide: MENU_ITEM_TOKEN,
      useExisting: MenuItemDirective,
    },
  ],
  host: {
    role: 'menuitem',
  },
})
export class MenuItemDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _trigger = inject(MENU_TRIGGER_TOKEN);
  private readonly _tabIndex = signal<number>(-1);

  @Input({ transform: booleanAttribute, alias: 'etMenuItemDisabled' })
  set __disabled(value: boolean) {
    this.disabled.set(value);
  }
  readonly disabled = signal<boolean>(false);

  readonly isFocused = computed(() => this._tabIndex() === 0);

  readonly hostAttributeBindings = signalHostAttributes({
    tabindex: this._tabIndex,
    'aria-disabled': this.disabled,
  });

  readonly hostClassBindings = signalHostClasses({
    'et-menu-item--disabled': this.disabled,
    'et-menu-item--focused': this.isFocused,
  });

  constructor() {
    fromEvent(this._elementRef.nativeElement, 'focus')
      .pipe(
        takeUntilDestroyed(),
        tap(() => this._setTabIndex()),
      )
      .subscribe();

    fromEvent(this._elementRef.nativeElement, 'blur')
      .pipe(
        takeUntilDestroyed(),
        tap(() => this._resetTabIndex()),
      )
      .subscribe();

    fromEvent<KeyboardEvent>(this._elementRef.nativeElement, 'keydown')
      .pipe(
        takeUntilDestroyed(),
        tap((event) => this._onKeydown(event)),
      )
      .subscribe();

    fromEvent<MouseEvent>(this._elementRef.nativeElement, 'mousedown')
      .pipe(
        takeUntilDestroyed(),
        tap((event) => this._handleMousedown(event)),
      )
      .subscribe();

    fromEvent(this._elementRef.nativeElement, 'click')
      .pipe(
        takeUntilDestroyed(),
        tap(() => this.trigger()),
      )
      .subscribe();
  }

  focus() {
    this._elementRef.nativeElement.focus();
  }

  trigger() {
    if (this.disabled()) return;

    this._trigger.unmount();
  }

  _setTabIndex(event?: MouseEvent) {
    if (this.disabled()) return;

    if (!event) {
      this._tabIndex.set(0);
    }
  }

  _resetTabIndex() {
    this._tabIndex.set(-1);
  }

  _onKeydown(event: KeyboardEvent) {
    switch (event.keyCode) {
      case SPACE:
      case ENTER:
        if (!hasModifierKey(event)) {
          this.trigger();
        }
        break;
    }
  }

  _handleMousedown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
}
