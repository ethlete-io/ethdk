import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

export type SelectSurfaceContext = {
  $implicit: SelectDirective;
  select: SelectDirective;
  close: () => void;
};

@Directive({
  selector: 'ng-template[etSelectSurface]',
  exportAs: 'etSelectSurface',
})
export class SelectSurfaceDirective {
  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectSurfaceContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.select?.registeredSurface.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.select?.registeredSurface() === this) {
        this.select.registeredSurface.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.SURFACE_OUTSIDE_SELECT,
            '[SelectSurfaceDirective] etSelectSurface must be placed inside an [etSelect] element.',
          );
        }
      });
    }
  }
}
