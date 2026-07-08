import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuDirective } from './menu.directive';

@Directive({
  selector: '[etMenuPanel]',
  exportAs: 'etMenuPanel',
  host: {
    role: 'menu',
    'aria-orientation': 'vertical',
    tabindex: '-1',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-busy]': 'busy()',
    '(keydown)': 'handleKeydown($event)',
    '(pointerenter)': 'handlePointerEnter($event)',
  },
})
export class MenuPanelDirective {
  /** @internal */
  public menu = inject(MenuDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  protected labelledBy = computed(() => this.menu?.registeredTrigger()?.elementRef.nativeElement.id ?? null);

  protected busy = computed(() => (this.menu?.registeredSearch()?.loading() ?? false) || null);

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-menu-panel');
    }

    this.menu?.registeredPanel.set(this);

    this.destroyRef.onDestroy(() => {
      this.menu?.unregisterPanel(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menu) {
          throw new RuntimeError(
            MENU_ERROR_CODES.PANEL_OUTSIDE_MENU,
            '[MenuPanelDirective] etMenuPanel must be rendered inside the surface of an [etMenu] element.',
          );
        }
      });
    }
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  protected handleKeydown(event: KeyboardEvent) {
    // items and the search input delegate their own keydowns - only handle keys targeting the panel itself
    if (event.target !== this.elementRef.nativeElement) {
      return;
    }

    this.menu?.handleKeydown(event);
  }

  protected handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      return;
    }

    this.menu?.notifyPanelPointerEnter();
  }
}
