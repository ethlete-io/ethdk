import { ENTER, SPACE, hasModifierKey } from '@angular/cdk/keycodes';
import {
  Directive,
  ElementRef,
  InjectionToken,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { fromEvent, merge, tap } from 'rxjs';
import { MENU_TRIGGER_TOKEN } from '../menu-trigger';

export const MENU_ITEM_TOKEN = new InjectionToken<MenuItemDirective>('MENU_ITEM_TOKEN');

@Directive({
  selector: 'et-menu-item, [et-menu-item], [etMenuItem]',
  standalone: true,
  providers: [
    {
      provide: MENU_ITEM_TOKEN,
      useExisting: MenuItemDirective,
    },
  ],
  host: {
    role: 'menuitem',
    class: 'et-menu-item',
  },
})
export class MenuItemDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _trigger = inject(MENU_TRIGGER_TOKEN);
  private readonly _tabIndex = signal<number>(-1);
  private readonly _closeOnInteraction = signal<boolean>(true);

  readonly disabled = input(false, { transform: booleanAttribute, alias: 'etMenuItemDisabled' });

  readonly isFocused = computed(() => this._tabIndex() === 0);

  readonly hostAttributeBindings = signalHostAttributes({
    tabindex: this._tabIndex,
    disabled: this.disabled,
    'aria-disabled': this.disabled,
  });

  readonly hostClassBindings = signalHostClasses({
    'et-menu-item--disabled': this.disabled,
    'et-menu-item--focused': this.isFocused,
  });

  constructor() {
    const el = this._elementRef.nativeElement;

    merge(
      fromEvent(el, 'focus').pipe(tap(() => this._setTabIndex())),
      fromEvent(el, 'blur').pipe(tap(() => this._resetTabIndex())),
      fromEvent<KeyboardEvent>(el, 'keydown').pipe(tap((event) => this._onKeydown(event))),
      fromEvent<MouseEvent>(el, 'mousedown').pipe(tap((event) => this._handleMousedown(event))),
      fromEvent(el, 'click').pipe(tap(() => this.trigger())),
    )
      .pipe(takeUntilDestroyed())
      .subscribe();
  }

  focus() {
    this._elementRef.nativeElement.focus();
  }

  trigger() {
    if (this.disabled() || !this._closeOnInteraction()) return;

    this._trigger.unmount();
  }

  _disableCloseOnInteraction() {
    this._closeOnInteraction.set(false);
  }

  _enableCloseOnInteraction() {
    this._closeOnInteraction.set(true);
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
  }
}
