import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderDirective, CascaderSurfaceContext } from './cascader.directive';

@Directive({
  selector: 'ng-template[etCascaderSurface]',
  exportAs: 'etCascaderSurface',
})
export class CascaderSurfaceDirective {
  private cascader = inject(CascaderDirective, { optional: true });
  public templateRef = inject<TemplateRef<CascaderSurfaceContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.cascader?.registeredSurface.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.cascader?.registeredSurface() === this) {
        this.cascader.registeredSurface.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.SURFACE_OUTSIDE_CASCADER,
            '[CascaderSurfaceDirective] etCascaderSurface must be placed inside an [etCascader] element.',
          );
        }
      });
    }
  }
}
