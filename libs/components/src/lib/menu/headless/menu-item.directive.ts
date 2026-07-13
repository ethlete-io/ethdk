import {
  DestroyRef,
  Directive,
  ElementRef,
  Signal,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

export type MenuItemActivationSource = 'pointer' | 'keyboard-enter' | 'keyboard-space';

export type MenuItemActivationEvent = {
  source: MenuItemActivationSource;
};

@Directive({
  selector: '[etMenuItem]',
  exportAs: 'etMenuItem',
  host: {
    '[attr.role]': 'role()',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.aria-disabled]': 'isDisabled() || null',
    '[attr.data-active]': 'isActive() || null',
    '(click)': 'handleClick($event)',
    '(keydown)': 'handleKeydown($event)',
    '(mousedown)': 'handleMousedown($event)',
    '(pointerenter)': 'handlePointerEnter($event)',
    '(focus)': 'handleFocus()',
  },
})
export class MenuItemDirective {
  private nearestMenu = inject(MenuDirective, { optional: true });
  private sameElementTrigger = inject(MenuTriggerDirective, { self: true, optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public disabled = input(false);
  public closeOnActivate = input<boolean | undefined>(undefined);
  public activate = output<MenuItemActivationEvent>();

  /** @internal The menu whose item list this item belongs to. */
  public owner: MenuDirective | null = null;
  /** @internal The submenu this item opens when it doubles as a submenu trigger. */
  public submenu: MenuDirective | null = null;

  /** @internal Role source overriding the default `menuitem`, e.g. with `menuitemradio` or `menuitemcheckbox`. */
  public roleOverride = signal<Signal<string> | null>(null);
  /** @internal Additional disabled state source, e.g. from a composing selection item directive. */
  public disabledOverride = signal<Signal<boolean> | null>(null);
  private defaultCloseOnActivate = true;
  private pendingKeyboardSource: MenuItemActivationSource | null = null;

  protected role = computed(() => this.roleOverride()?.() ?? 'menuitem');

  protected isActive = computed(() => this.owner?.activeItem() === this);

  /** @internal Combines the item's own `disabled` input with a state pushed in by a composing directive. */
  public isDisabled = computed(() => this.disabled() || (this.disabledOverride()?.() ?? false));

  protected tabIndex = computed(() => {
    const owner = this.owner;

    if (!owner || this.isDisabled()) {
      return -1;
    }

    const active = owner.activeItem();

    if (active) {
      return active === this ? 0 : -1;
    }

    return owner.enabledItems()[0] === this ? 0 : -1;
  });

  constructor() {
    const nearest = this.nearestMenu;
    const trigger = this.sameElementTrigger;

    // an item that is also a submenu trigger sits inside the nested [etMenu] element,
    // but as a focusable row it belongs to the parent menu's item list
    if (nearest && trigger && trigger.menu === nearest) {
      this.owner = nearest.parent;
      this.submenu = nearest;
      trigger.setHostItem(this);
    } else {
      this.owner = nearest;
    }

    this.owner?.registerItem(this);

    this.destroyRef.onDestroy(() => {
      this.owner?.unregisterItem(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.owner) {
          throw new RuntimeError(
            MENU_ERROR_CODES.ITEM_OUTSIDE_MENU,
            '[MenuItemDirective] etMenuItem must be rendered inside the surface of an [etMenu] element. When combined with etMenuTrigger, the [etMenu] element must be nested inside a parent menu.',
          );
        }
      });
    }
  }

  /** @internal Sets whether activation closes the menu tree when the `closeOnActivate` input is not set. */
  public setDefaultCloseOnActivate(value: boolean) {
    this.defaultCloseOnActivate = value;
  }

  /** @internal */
  public focus() {
    const element = this.elementRef.nativeElement;

    element.focus({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest' });
  }

  /** @internal Returns the visible label used for typeahead matching. */
  public textContent() {
    return this.elementRef.nativeElement.textContent?.trim() ?? '';
  }

  /** @internal Activates via a synthesized click so consumer (click) handlers fire for keyboard users too. */
  public activateFromKeyboard(source: MenuItemActivationSource) {
    if (this.isDisabled()) {
      return;
    }

    this.pendingKeyboardSource = source;
    this.elementRef.nativeElement.click();
  }

  protected handleClick(event: MouseEvent) {
    const source = this.pendingKeyboardSource ?? 'pointer';

    this.pendingKeyboardSource = null;

    // pointer clicks on submenu trigger items are handled by the trigger itself
    if (this.sameElementTrigger) {
      return;
    }

    if (this.isDisabled()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    this.activate.emit({ source });

    if (this.closeOnActivate() ?? this.defaultCloseOnActivate) {
      this.owner?.closeAll('item');
    }
  }

  protected handleKeydown(event: KeyboardEvent) {
    this.owner?.handleKeydown(event);
  }

  protected handleMousedown(event: MouseEvent) {
    // keeps focus where it is (menu or an outside editor) while still allowing the click
    event.preventDefault();
  }

  protected handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      return;
    }

    this.owner?.notifyItemPointerEnter(this);
  }

  protected handleFocus() {
    this.owner?.activeItem.set(this);
  }
}
