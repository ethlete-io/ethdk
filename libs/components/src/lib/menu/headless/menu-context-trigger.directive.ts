import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject, untracked } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { Subscription, fromEvent, tap } from 'rxjs';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuDirective } from './menu.directive';

@Directive({
  selector: '[etMenuContextTrigger]',
  exportAs: 'etMenuContextTrigger',
  host: {
    '[attr.data-menu-open]': 'isOpen() || null',
    '(contextmenu)': 'handleContextMenu($event)',
  },
})
export class MenuContextTriggerDirective {
  private menu = inject(MenuDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  private repositionSubscription: Subscription | null = null;

  constructor() {
    this.menu?.registeredContextTrigger.set(this);

    // while the menu is open the pane can cover the context zone, so right clicks are
    // intercepted at document level - including those landing on the pane - to reposition
    effect(() => {
      const open = this.menu?.open() ?? false;

      untracked(() => {
        if (open) {
          this.attachRepositionListener();
        } else {
          this.detachRepositionListener();
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.detachRepositionListener();
      this.menu?.unregisterContextTrigger(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menu) {
          throw new RuntimeError(
            MENU_ERROR_CODES.CONTEXT_TRIGGER_OUTSIDE_MENU,
            '[MenuContextTriggerDirective] etMenuContextTrigger must be placed inside an [etMenu] element.',
            { element: this.elementRef.nativeElement },
          );
        }

        if (this.menu && !this.menu.isRoot) {
          throw new RuntimeError(
            MENU_ERROR_CODES.CONTEXT_TRIGGER_ON_SUBMENU,
            '[MenuContextTriggerDirective] etMenuContextTrigger can only open root menus. Move it to the outermost [etMenu] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  public isOpen() {
    return this.menu?.open() ?? false;
  }

  protected handleContextMenu(event: MouseEvent) {
    // while open, the document-level listener owns repositioning
    if (!this.menu || this.menu.disabled() || this.menu.open()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.menu.openAt({ x: event.clientX, y: event.clientY });
  }

  private attachRepositionListener() {
    if (this.repositionSubscription) {
      return;
    }

    // the zone's own document, resolved on attach - the host may have been adopted by another window
    this.repositionSubscription = fromEvent<MouseEvent>(this.elementRef.nativeElement.ownerDocument, 'contextmenu', {
      capture: true,
    })
      .pipe(
        tap((event) => {
          if (!this.menu || this.menu.disabled() || !this.isEventOnZone(event)) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          this.menu.openAt({ x: event.clientX, y: event.clientY });
        }),
      )
      .subscribe();
  }

  private detachRepositionListener() {
    this.repositionSubscription?.unsubscribe();
    this.repositionSubscription = null;
  }

  private isEventOnZone(event: MouseEvent) {
    const zone = this.elementRef.nativeElement;

    if (event.target instanceof Node && zone.contains(event.target)) {
      return true;
    }

    // right clicks landing on the open pane never target the zone - compare coordinates instead
    const rect = zone.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }
}
