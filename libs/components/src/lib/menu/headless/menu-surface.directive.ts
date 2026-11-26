import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuDirective } from './menu.directive';

export type MenuSurfaceContext = {
  $implicit: MenuDirective;
  menu: MenuDirective;
  close: (result?: unknown) => void;
};

@Directive({
  selector: 'ng-template[etMenuSurface]',
  exportAs: 'etMenuSurface',
})
export class MenuSurfaceDirective {
  private menu = inject(MenuDirective, { optional: true });
  public templateRef = inject<TemplateRef<MenuSurfaceContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement();

  constructor() {
    this.menu?.registeredSurface.set(this);

    this.destroyRef.onDestroy(() => {
      this.menu?.unregisterSurface(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menu) {
          throw new RuntimeError(
            MENU_ERROR_CODES.SURFACE_OUTSIDE_MENU,
            '[MenuSurfaceDirective] etMenuSurface must be placed inside an [etMenu] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
